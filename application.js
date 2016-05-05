// The public interface to the application layer of the system.
var Application = (function() {
  'use strict';

  // starting state of Game
  var GameState = {
    isInitialised: false,
    turnOwner: null,
    turnsTaken: 0,
  };

  // TODO convert INITIALISE related logic into something better.
  function initialise() {
    Utility.assert(!GameState.isInitialised, 'Application initialised twice');
    GameState.isInitialised = true;

    // TODO initialise the deck and hands

    onUpdate(GameState);
  }

  function readyUp() {
    Network.requestStart();
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
    console.log(newState);// TODO
    console.log(GameState);// TODO
    // 1. Ensure that the turn order is logically consistent
    //    with respect to the happened-before relationship.
    Utility.assert(newState.turnsTaken >= GameState.turnsTaken,
        'turnsTaken must monotonically increase; new: ' + newState.turnsTaken +
        '; old: ' + GameState.turnsTaken);
    GameState = newState;

    // 2. In the view, update:
    //     * Card pile
    //     * Player's hand
    //     * Other player's hand sizes
    RootComponent.setState(newState);

    // TODO
    // 3. If a player has won, display their victory.
    // 4. Enable the Uno button if this player is on the Uno list,
    //    else enable it.
    // 5. Enable the Gotcha button if a different player is on the Uno
    //    list, else disable it.
  }

  var NORMAL = 'normal';
  var SKIP = 'skip';

  // Called when the previous process passes the turn to us.
  function onTurnReceived(type) {
    switch (type) {
      case NORMAL:
        // TODO 1. Allow the player to take their turn.
        RootComponent.setState({isMyTurn: true});
        break;

      case SKIP:
        // Called when the previous process skips us, including
        // 'draw' cards.
        // TODO 1. Pass the turn to the next player.

        break;

      default:
        throw 'incomplete branch coverage in onTurnReceived switch statement';
    }
  }

  function onFirstTurn(pid) {
    GameState.turnOwner = pid;
    RootComponent.setState({isMyTurn: true});
  }

  // Called when another process tells this process to draw cards.
  // As in, pick up some cards, not render them.
  //
  // This has nothing to do with taking a turn or holding the lock
  // on the game state.
  // Locally displayed cards are not part of the game state,
  // so no message has to be sent.
  function onDraw(count) {
    // TODO
    // 1. Choose, and add to the local hand, an appropriate number
    //    of cards.
  };

  // Called when the player takes their turn using the UI.
  function onTurnTaken() {

    // 1. Take the turn, by counting how many turns have occured.
    // TODO replace with actual turn taking logic using cards, etc.
    GameState.turnsTaken++;
    var newState = GameState;
    Utility.log("I'm taking my turn now (" + newState.turnsTaken + ')');

    // TODO 2. If I have only one card left, add me to the Uno list.
    // TODO 3. If I have more than one card left, remove me from the Uno list.

    // 4. Pass the turn to the next process.
    // TODO base `type` on which card was played.
    // TODO Wait for an ack.
    var turnType = NORMAL;
    Network.endTurn(turnType, newState);
    newState.isMyTurn = false;

    // 5. update my own view
    onUpdate(newState);
  }

  // === Uno functions ===
  //
  // The approach here is to use the current turn-taker as a central
  // server for mutex on the Uno list, and as a sequencer for
  // TO-Multicasting of Uno/Gotcha calls.
  //
  // It might be better to pick a different approach.

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

    // Turn taking
    onTurnTaken: onTurnTaken,

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
    onDraw: onDraw,

    // Uno/gotcha
    onUnoMessage: onUnoMessage,
    onGotchaMessage: onGotchaMessage,
  };
})();

console.log(Application);

document.addEventListener('DOMContentLoaded', function () {
});
