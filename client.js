(function () {
  var URL = window.location.href;
  // decide on the rooom based on the ?room=name querystring parameter
  var ROOM = 'comp90020-uno-' + (URL.indexOf('room') > 0 ?
                                 URL.substr(URL.indexOf('room') + 5) :
                                 'everyone');
  var TOPOLOGY = 'top';
  var TURN = 'turn';
  var STATE = 'state';
  var INITIALISE = 'init';
  var PREINITIALISED = 'pre-init';

  var webrtc = new SimpleWebRTC({
    media: {
      video: false,
      audio: false,
    },
  });

  var assert = function (message, predicate) {
    if (!predicate) {
      console.log('assertion failed: ' + message);
    }
  };

  var logMessage = function (peer, label, payload) {
    console.log('Received a ' + label + ' message from ' + peer.id + ': ' +
                payload);
  };

  var show = function (message) {
    console.log(new Date() + ': ' + message);
  };

  var logAndShowMessage = function (peer, label, payload) {
    logMessage(peer, label, payload);
    show('Peer ' + peer.id + ' sent us a ' + label + ' message: "' +
         payload + '"');
  };

  var sendToPid = function (target, room, type, message) {
    show('Sending to peer ' + target);
    var peers = webrtc.getPeers();
    var peer = peers.filter(function (p) { return p.id === target; })[0];
    assert('target missing', peer !== undefined);
    peer.sendDirectly(room, type, message);
  };

  var myPid;
  var isMyTurn = false;
  var leader = null;
  var isInitialised = false;
  var turn = 0;
  var topology = [];
  var nextPid = {};

  // TODO convert INITIALISE related logic into something better.
  var initialise = function () {
    isInitialised = true;
    var peers = webrtc.getPeers();
    show('Initial peer list is ' +
         peers.map(function (p) { return p.id; }).join(', '));

    // Choose the lowest myPid as the leader.
    show('My myPid is ' + myPid);
    leader = myPid;
    peers.forEach(function (p) {
      if (p.id < leader) leader = p.id;
    });
    show('The leader is now ' + leader);

    // Give the first turn to the leader.
    if (leader === myPid) {
      isMyTurn = true;
      show('It\'s my turn first!');
    }
  };

  // we have to wait until it's ready
  webrtc.on('readyToCall', function () {
    myPid = webrtc.connection.connection.id;
    show('My myPid is ' + myPid);

    webrtc.joinRoom(ROOM);
    webrtc.sendDirectlyToAll(ROOM, INITIALISE);
    // TODO Replace dodgy busy wait with something good.

    webrtc.on('channelMessage', function (peer, room, data, other) {
      switch (data.type) {
        case TOPOLOGY:
          logAndShowMessage(peer, 'TOPOLOGY', data.payload);

          topology = data.payload.split(',');
          topology.forEach(function (pid, i) {
            var iNext = (i + 1 >= topology.length) ? 0 : i + 1;
            nextPid[pid] = topology[iNext];
          });
          show('Current topology is ' + topology.join(', '));
          leader = topology[0];
          show('The leader is now ' + leader);

          break;

        case TURN:
          logAndShowMessage(peer, 'TURN', data.payload);
          // TODO
          isMyTurn = true;
          var newTurn = parseInt(data.payload);
          assert('turn is monotonic', newTurn > turn);
          turn = newTurn;
          break;

        case STATE:
          logAndShowMessage(peer, 'STATE', data.payload);
          onUpdate(data.payload);
          break;

        case INITIALISE:
          // TODO convert INITIALISE related logic into something better.
          logAndShowMessage(peer, 'INITIALISE', data.payload);
          if (isInitialised) {
            peer.sendDirectly(ROOM, PREINITIALISED);
            if (leader === myPid) {
              peer.sendDirectly(ROOM, TOPOLOGY, topology);
            }
          } else {
            initialise();
            peer.sendDirectly(ROOM, INITIALISE);
          }
          break;

        case PREINITIALISED:
          // TODO convert INITIALISE related logic into something better.
          logAndShowMessage(peer, 'PREINITIALISED', data.payload);
          isInitialised = true;
          break;
      }
    });

    setInterval(function () {
      // TODO convert INITIALISE related logic into something better.
      if (!isInitialised) {
        var peers = webrtc.getPeers();
        if (peers.length !== 0) {
          webrtc.sendDirectlyToAll(ROOM, INITIALISE);
        }
        return;
      }

      // If it's our turn, then:
      if (isMyTurn) {
        turn += 1;
        show('I\'m taking my turn now (' + turn + ')');

        // Send the topology if we own it.
        if (leader === myPid) {
          onLeaderTurn();
        }

        // Take my turn.
        onTurnTaken();
      }
    }, 1500 * (Math.random() + 1));
  });

  // === Topology functions ===
  //
  // The game uses a ring based topology for turn taking,
  // and broadcasts for sharing state.
  // The group of processes to receive broadcasts is automatically
  // managed by WebRTC.
  // The ring topology is managed by our code.
  //
  // The approach to the ring topology is to manage it with a
  // specific 'leader' process.
  // The leader process is the live process who is earliest in the
  // topology.
  //
  // A process may be in one of three states:
  //
  // A live process is one which is participating correctly in the
  // turn order.
  // A dead process is one which was previously live, but has either
  // crashed or lost contact with the other processs.
  // A pending process is one which is operating correctly and in
  // contact with the other processs, but is not yet participating in
  // the turn order.
  //
  // The leader is responsible for adding new processs to the
  // topology.
  // New processs are added at the end of the ring, and are initially
  // pending.
  // When the leader takes their turn, they change all pending
  // processs into live processs.
  //
  // When the leader dies, the first process to detect it should call
  // an election.
  // A new leader should be elected via either the ring based
  // algorithm or a more advanced algorithm; to be determined.

  // Called when this process starts and joins the network.
  var onJoin = function () {
    // TODO
    // 1. Request the current topology, and to join it.
  };

  // Called at the leader process when a processs tries to join.
  var onJoinRequest = function () {
    // TODO
    // 1. Add the new process to the topology, as pending.
    // 2. Broadcast the new topology.
  };

  // Called at the leader process before taking a turn.
  var onLeaderTurn = function () {
    show('Taking turn as leader.');

    // TODO 1. Set all pending processs to be live.

    // Until step 1 is implemented, just recalculate the topology instead.
    var peers = webrtc.getPeers();
    topology = [myPid].concat(peers.map(function (p) { return p.id; }));
    topology.forEach(function (pid, i) {
      var iNext = (i + 1 >= topology.length) ? 0 : i + 1;
      nextPid[pid] = topology[iNext];
    });

    // 2. Broadcast the new topology.
    webrtc.sendDirectlyToAll(ROOM, TOPOLOGY, topology.join(','));
  };

  // Called when a process receives a topology update.
  var onTopologyUpdate = function () {
    // TODO
    // 1. Remember the topology.
  };

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
  var onUpdate = function (newState) {
    // TODO
    // 1. In the view, update:
    //     * Card pile
    //     * Player's hand
    //     * Other player's hand sizes
    // 2. If a player has won, display their victory.
    // 3. Enable the Uno button if this player is on the Uno list,
    //    else enable it.
    // 4. Enable the Gotcha button if a different player is on the Uno
    //    list, else disable it.

    // force the state to be an object
    newState = Object(newState);
    RootComponent.setState(newState);
  };

  // Called when the previous process passes the turn to us.
  var onTurn = function () {
    // TODO
    // 1. Allow the player to take their turn.
  };

  // Called when the previous process skips us.
  var onSkip = function () {
    // TODO
    // 1. Pass the turn to the next player.
  };

  // Called when another process tells this process to draw cards.
  //
  // This has nothing to do with taking a turn or holding the lock
  // on the game state.
  // Locally displayed cards are not part of the game state,
  // so no message has to be sent.
  var onDraw = function () {
    // TODO
    // 1. Choose, and add to the local hand, an appropriate number
    //    of cards.
  };

  // Called when the player takes their turn using the UI.
  var onTurnTaken = function () {
    // 1. Stop the player from taking a second turn.
    // TODO Wait for an ack, and use a ring, not random.
    isMyTurn = false;

    // TODO 2. If I have only one card left, add me to the Uno list.
    // TODO 3. If I have more than one card left, remove me from the Uno list.

    newState = {message: 'I just took turn: ' + turn};
    // 4. Broadcast the new update.
    webrtc.sendDirectlyToAll(ROOM, STATE, newState);

    // 5. update my own view
    onUpdate(newState);

    // 6. Pass the turn to the next process.
    sendToPid(nextPid[myPid], ROOM, TURN, turn);
  };

  // === Uno functions ===
  //
  // The approach here is to use the current turn-taker as a central
  // server for mutex on the Uno list, and as a sequencer for
  // TO-Multicasting of Uno/Gotcha calls.
  //
  // It might be better to pick a different approach.

  // Called when the player calls Uno via the UI.
  var onUnoButton = function () {
    // TODO
    // 1. Broadcast the uno message.
  };

  // Called when the player calls Gotcha via the UI.
  var onGotchaButton = function () {
    // TODO
    // 1. Broadcast the gotcha message.
  };

  // Called when another process sends us an Uno message.
  var onUnoMessage = function () {
    // TODO
    // 1. Disregard the message if it's not my turn,
    //    since I don't own the state.
    // 2. Remove the player who called Uno from the Uno list.
    // 3. Broadcast the new state.
  };

  // Called when another process sends us a Gotcha message.
  var onGotchaMessage = function () {
    // TODO
    // 1. Disregard the message if it's not my turn,
    //    since I don't own the state.
    // 2. Add seven cards to the hand of all players on the Uno list.
    //    Tell the corresponding processes to choose seven cards to
    //    add to their local hands.
    // 3. Broadcast the new state.
  };

  // === TODO Failure handling functions ===
  //
  // Not sure what the approach is here.
  //
  // Maybe handle it with a decorator around SimpleWebRTC?
})();
