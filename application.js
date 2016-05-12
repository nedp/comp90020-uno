// The public interface to the application layer of the system.
var Application = (function () {
  'use strict';

  // starting state of Game
  var GameState = {
    turnOwner: null,
    topCard: null,
    turnsTaken: 0,
  };

  // starting state of my player
  var LocalState = {
    myHand: [],
    isInitialised: false,
  };

  // TODO convert INITIALISE related logic into something better.
  function initialise() {
    Utility.assert(!LocalState.isInitialised, 'Application initialised twice');
    LocalState.isInitialised = true;

    // TODO initialise the deck and hands
    for (var x = 0; x < 7; x++) {
      LocalState.myHand.push(CardFetcher.fetchCard());
    }

    updateView();
  }

  // Called when the player presses the ready button to indicate that
  // they're ready to start the game.
  // This allows players to wait until we have agreed that everyone is
  // ready before starting the game.
  // Dynamically bind Network.readyUp instead of statically binding it,
  // to make the dependency more flexible.
  function readyUp() {
    return Network.readyUp();
  }

  // === Turn and state functions ===
  //
  // The approach here is to use a ring based mutex algorithm for
  // turn taking.
  //
  // All game state is considered to be locked by whichever
  // process is currently taking a turn.
  //
  // The game state includes:
  //
  // * The number of cards in each player's hand;
  //   but not the specific cards.
  // * The top card on the discard pile.
  // * The 'Uno list', a list of players who have one card
  //   left but haven't yet called Uno, so are vulnerable to
  //   a Gotcha call.

  // Called when another process sends us a state update.
  function onUpdate(newState) {
    // 1. Ensure that the turn order is logically consistent
    //    with respect to the happened-before relationship.
    Utility.assert(newState.turnsTaken >= GameState.turnsTaken,
        'turnsTaken must monotonically increase; new: ' + newState.turnsTaken +
        '; old: ' + GameState.turnsTaken);
    GameState = newState;

    updateView();
  }

  function updateView() {
    // Object for view-specific variables that need to be processed
    // before sending to the view.
    var newViewState = {};

    // 1. Convert the topCard into a card (not a string).
    if (GameState.topCard) {
      newViewState.topCard = CardFetcher.fromString(GameState.topCard);
    }

    // 2. In the view, update:
    //     * Card pile
    //     * Player's hand
    //     * Other player's hand sizes
    var combinedState = {};
    Object.assign(combinedState, LocalState, GameState, newViewState);

    RootComponent.setState(combinedState);

    // TODO
    // 3. If a player has won, display their victory.
    // 4. Enable the Uno button if this player is on the Uno list,
    //    else enable it.
    // 5. Enable the Gotcha button if a different player is on the Uno
    //    list, else disable it.
  }

  // Called when the previous process passes the turn to us.
  function onTurnReceived() {
    // Allow the player to take their turn.
    LocalState.isMyTurn = true;
    updateView();
  }

  function onFirstTurn(pid) {
    GameState.turnOwner = pid;

    // Create the top card on the deck
    GameState.topCard = CardFetcher.fetchCard().toString();

    // Broadcast state to peers so they can see the top card
    Network.broadcastState(GameState);

    // Update the fact that it's how turn
    LocalState.isMyTurn = true;

    // Update the view
    updateView();
  }

  // Called when another process tells this process to draw cards.
  // As in, pick up some cards, not render them.
  //
  // This has nothing to do with taking a turn or holding the lock
  // on the game state.
  // Locally displayed cards are not part of the game state,
  // so no message has to be sent.
  function draw(count) {
    for (var x = 0; x < count; x++) {
      LocalState.myHand.push(CardFetcher.fetchCard());
    }
  }

  // Called when the player takes their turn using the UI.
  function finishTurn(turnType, nCardsToDraw) {
    console.log('finishTurn');

    // 1. Take the turn, by counting how many turns have occured.
    // TODO replace with actual turn taking logic using cards, etc.
    GameState.turnsTaken++;
    Utility.log("I'm taking my turn now (" + GameState.turnsTaken + ')');

    // TODO 2. If I have only one card left, add me to the Uno list.
    // TODO 3. If I have more than one card left, remove me from the Uno list.

    // 4. Pass the turn to the next process.
    // TODO Wait for an ack.
    Network.endTurn(turnType, GameState, nCardsToDraw);
    LocalState.isMyTurn = false;

    // 5. update my own view
    updateView();
  }

  // === Uno functions ===
  //
  // The approach here is to use the current turn-taker as a central
  // server for mutex on the Uno list, and as a sequencer for
  // TO-Multicasting of Uno/Gotcha calls.
  //
  // It might be better to pick a different approach.

  // Called when a user wishes to pickup from the deck instead of playing
  // a card from their hand
  function pickupCard() {
    // Only pickup if it's our turn
    if (LocalState.isMyTurn) {
      // Add a new card to my hand from the deck
      LocalState.myHand.push(CardFetcher.fetchCard());

      // Finish the turn.
      // If we picked up a card, then the next player gets a normal turn.
      finishTurn(TurnType.NORMAL);
    }
  }

  function isValidTurn(card, topCard) {
    // Wild cards are always ok.
    if (card.type === CardFetcher.CARDTYPES.WILD) return true;
    if (card.type === CardFetcher.CARDTYPES.WILDDRAW4) return true;

    // They played a reverse/skip/draw on a different coloured
    // card of the same type.
    if (card.type !== CardFetcher.CARDTYPES.NUMBER &&
        card.type === topCard.type) {
      return true;
    }

    // If it's the same number or suite it's fine.
    if (card.number !== null && card.number === topCard.number) return true;
    if (card.suit && card.suit === topCard.suit) return true;

    // If none of the above conditions held, it's an invalid move.
    return false;
  }

  // Called when a user attempts to play a card from their hand
  function playCard(card) {
    // Get the card representation of the top card
    var tc = CardFetcher.fromString(GameState.topCard);

    // Don't allow invalid moves to be made.
    if (!LocalState.isMyTurn || !isValidTurn(card, tc)) {
      Utility.log('Invalid Turn!');
      return;
    }
    Utility.log('Valid Move!');

    // If it's a wild card and the suit is not already selected,
    // turn the view into a suit selection.
    if (card.needsSuitSelection) {
      LocalState.requestSpecial = card;
      updateView();
      return;
    }

    // Remove the original card from their hand.
    // In most cases this is the same card, but if it's a wild
    // we want to find the wild with no suit attached to it.
    // If there are duplicates, just take the first one.
    var originalCard = LocalState.requestSpecial || card;
    var cardIndex = LocalState.myHand.indexOf(originalCard);
    LocalState.myHand.splice(cardIndex, 1);

    // Place the card on top.
    GameState.topCard = card.toString();

    // Remove the special flag if it was set from above
    // meaning the user has now chosen a suit for their wild.
    if (LocalState.requestSpecial) {
      LocalState.requestSpecial = null;
    }

    finishTurn(card.turnType, card.nCardsToDraw);
  }

  function cancelSuitSelection() {
    LocalState.requestSpecial = null;
    updateView();
  }

  // Called when the player calls Uno via the UI.
  function onUnoButton() {
    // TODO
    // 1. Broadcast the uno message.
  }

  // Called when the player calls Gotcha via the UI.
  function onGotchaButton() {
    // TODO
    // 1. Broadcast the gotcha message.
  }

  // Called when another process sends us an Uno message.
  function onUnoMessage() {
    // TODO
    // 1. Disregard the message if it's not my turn,
    //    since I don't own the state.
    // 2. Remove the player who called Uno from the Uno list.
    // 3. Broadcast the new state.
  }

  // Called when another process sends us a Gotcha message.
  function onGotchaMessage() {
    // TODO
    // 1. Disregard the message if it's not my turn,
    //    since I don't own the state.
    // 2. Add seven cards to the hand of all players on the Uno list.
    //    Tell the corresponding processes to choose seven cards to
    //    add to their local hands.
    // 3. Broadcast the new state.
  }

  return {
    // ==== For front end ====

    // State changes
    readyUp: readyUp,

    // special method for cancelling suit selection
    cancelSuitSelection: cancelSuitSelection,

    // Turn taking
    pickupCard: pickupCard,
    playCard: playCard,

    // Uno/gotcha
    onUnoButton: onUnoButton,
    onGotchaButton: onGotchaButton,

    // ==== For Network ====

    // State changes
    initialise: initialise,
    onUpdate: onUpdate,

    // Turn taking and drawing
    onFirstTurn: onFirstTurn,
    onTurnReceived: onTurnReceived,
    draw: draw,

    // Uno/gotcha
    onUnoMessage: onUnoMessage,
    onGotchaMessage: onGotchaMessage,
  };
})();
