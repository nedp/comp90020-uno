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
    cardCounts: {},
    winner: null,
    // remember who is in uno / safe from gotcha
    unoSet: {},
    // only need to keep my time taken to press uno
    timeTakenToUno: null,
  };

  // time between when someone calls uno for themselves and we have to pick up
  // 4 cards if we accidentally call it on them after that
  var SAFE_UNO_SURROUNDING = 5000; // 5 seconds

  // TODO convert INITIALISE related logic into something better.
  function initialise() {
    Utility.assert(!LocalState.isInitialised, 'Application initialised twice');
    LocalState.isInitialised = true;

    // Clear any state from a previous game
    LocalState.winner = null;
    LocalState.myHand = [];

    // initialise my hand
    for (var x = 0; x < 7; x++) {
      LocalState.myHand.push(CardFetcher.fetchCard());
    }

    // Assume everyone has 7 cards, we will receive updates from them that
    // overwrite this anyway
    var cardCounts = {};
    Network.players.forEach(function (playerId) {
      cardCounts[playerId] = 7;
    });
    LocalState.cardCounts = cardCounts;

    // notify everyone of my card count
    updateMyCardCount();

    // draw the view with my newly drawn cards
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
    GameState = newState;

    updateView();
  }

  // update the number of cards in our peers hand
  function onUpdateCardCount(peerId, numCards) {
    LocalState.cardCounts[peerId] = numCards;

    // if they just hit uno
    if (numCards === 1) {
      // update the time since we saw them go into uno-mode (in milliseconds)
      LocalState.unoSet[peerId] = +new Date();
    } else if (LocalState.unoSet[peerId]) {
      // they shouldn't be in the uno set anymore, unmark them
      delete LocalState.unoSet[peerId];
    }

    updateView();
  }

  // When someone else wins we need to show this
  function onSomeoneWon(winner) {
    // mark the winner of the game
    LocalState.winner = winner;

    // Prepare for the next game by uninitialising our state
    LocalState.isInitialised = false;

    // wipe the ready set in the view
    updateViewSpecific({ready: {}});

    // update the view with all the local and gamestate data
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

  function updateViewSpecific(state) {
    RootComponent.setState(state);
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
  //
  // Draw here means "picks up", but we also render the cards.
  //
  // This has nothing to do with taking a turn or holding the lock
  // on the shared game state.
  // Locally displayed cards are not part of the shared game state,
  // so no message has to be sent.
  function draw(count) {
    for (var x = 0; x < count; x++) {
      LocalState.myHand.push(CardFetcher.fetchCard());
    }

    updateMyCardCount();
  }

  // Called when we want to update the card count shown locally
  // as well as sending out card count to others
  function updateMyCardCount() {
    var count = LocalState.myHand.length;

    // update my local state
    LocalState.cardCounts[Network.myId] = count;

    // checks for local card in the uno set
    if (count === 1) {
      LocalState.unoSet[Network.myId] = +new Date();
      LocalState.timeTakenToUno = null;
    } else if (LocalState.unoSet[Network.myId]) {
      // Store locally how long it took me to say uno / get out of uno
      // and remove myself from the unoSet
      // This allows other people to still call uno if I just picked up a new
      // card but they saw me on 1 card and called gotcha faster than it took
      // me to move out of being vulnerable
      LocalState.timeTakenToUno = +new Date() - LocalState.unoSet[Network.myId];
      delete LocalState.unoSet[Network.myId];
    }

    // update the view
    updateView();

    // update the network with my new number of cards
    Network.broadcastCardCount(count);
  }

  // Called when the player takes their turn using the UI.
  function finishTurn(turnType, nCardsToDraw) {
    console.log('finishTurn');

    // 1. Take the turn, counting how many turns have occured.
    GameState.turnsTaken++;
    Utility.log("I'm taking my turn now (" + GameState.turnsTaken + ')');

    // Update my local card count and tell everyon else
    updateMyCardCount();

    // winning condition
    if (LocalState.myHand.length === 0) {
      // Last card has been played, let everyone know I've won
      Network.broadcastWin(GameState);
      LocalState.winner = Network.myId;

      // Prepare for the next game by uninitialising our state
      LocalState.isInitialised = false;
      LocalState.isMyTurn = false;

      // wipe the ready set in the view
      updateViewSpecific({ready: {}});
    } else {
      // 4. Pass the turn to the next process.
      // TODO Wait for an ack.
      Network.endTurn(turnType, GameState, nCardsToDraw);
      LocalState.isMyTurn = false;
    }

    // 6. update my own view
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

    // Only remove the played card if it exists in the hand.
    // Prevents issue when the initial card is a wild card, the user should get
    // to choose the colour and then skip their turn, it's a side effect but
    // one that works reasonably nicely (without this condition they play
    // the wild card and then it removes the first card in their hand also).
    if (cardIndex > -1) {
      LocalState.myHand.splice(cardIndex, 1);
    }

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
    LocalState.timeTakenToUno = +new Date() - LocalState.unoSet[Network.myId];
    Network.broadcastUno(LocalState.timeTakenToUno);

    // remove the uno button
    updateView();
  }

  // Called when the player calls Gotcha via the UI.
  function onGotchaButton(peerId) {
    if (LocalState.unoSet[peerId]) {
      // send them a gotcha message only when we think they haven't pressed
      // uno yet from our point of view
      Network.sendGotcha(peerId, +new Date() - LocalState.unoSet[peerId]);
    } else if (LocalState.cardCounts[peerId] !== 1) {
      // draw 4 cards for calling gotcha when they aren't actually on 1 card
      // left (we don't want to penalise someone for saying gotcha to someone
      // with one card even if they are safe)
      draw(4);
    }
  }

  // Called when another process sends us an Uno message
  // letting us know they are safe and how long it took them
  // to say uno
  function onUnoMessage(peer, timeTaken) {
    // bookmark what time they received their 1 card at
    var unoTime = LocalState.unoSet[peer];

    // there may be a bit of time before we can call uno on them
    // but even if they called it first, we want to wait a safe period before
    // making us pick up 4 cards for incorrectly calling them out
    if (LocalState.unoSet[peer]) {
      // how long has elapsed compared to the uno guy,
      // we may still have extra time before we are at his timing
      // if so take it into account in the timeout
      var timeDiff = Math.abs(+new Date() - LocalState.unoSet[peer] - timeTaken);
      // only remove them from the LocalState.unoSet once it's taken us
      // longer to say gotcha than them to say uno
      setTimeout(function () {
        // make sure if we are wiping it, it's for the right uno
        if (LocalState.unoSet[peer] && LocalState.unoSet[peer] === unoTime) {
          delete LocalState.unoSet[peer];
        }
        updateView();
      }, timeDiff);
    }
  }

  // Called when another process sends us a Gotcha message.
  function onGotchaMessage(peerId, timing) {
    // if I haven't called it in time or if they called it quicker than me
    if (LocalState.unoSet[Network.myId] && LocalState.timeTakenToUno === null ||
        LocalState.timeTakenToUno !== null && timing < LocalState.timeTakenToUno) {
      // they called me out in time, draw 4 cards
      draw(4);
    }
    // don't do anything otherwise, either they didn't beat me to the punch
    // time-wise, or the message was sent when I was on uno for them
    // but am no longer on uno now (i.e. they saw me on uno so they shouldn't
    // be penalised but I shouldn't have to draw cards)
  }

  // Forcibly cancels this process' turn, used during recovery.
  function cancelTurn() {
    LocalState.isMyTurn = false;
    console.log('canceling turn');
    updateView();
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
    onUpdateCardCount: onUpdateCardCount,
    onSomeoneWon: onSomeoneWon,

    // Turn taking and drawing
    onFirstTurn: onFirstTurn,
    onTurnReceived: onTurnReceived,
    draw: draw,
    cancelTurn: cancelTurn,

    // Uno/gotcha
    onUnoMessage: onUnoMessage,
    onGotchaMessage: onGotchaMessage,
  };
})();
