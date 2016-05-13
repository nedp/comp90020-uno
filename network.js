// The public interface to the network layer of the system.
var Network = (function () {
  'use strict';

  // Decide which room to use based on the query string in the url.
  // ``` ?room=name querystring parameter ```
  // This allows multiple games to exist concurrently.
  var URL = window.location.href;
  var ROOM = 'comp90020-uno-' + (URL.indexOf('room') > 0 ?
                                 URL.substr(URL.indexOf('room') + 5) :
                                 'everyone');

  // Message types.
  var TOPOLOGY = 'top';
  var TURN = 'turn';
  var STATE = 'state';
  var READY = 'ask-init';
  var INITIALISE = 'init';
  var PREINITIALISED = 'pre-init';
  var CARD_COUNT = 'card-count';

  // myPid uniquely identifies this process.
  var myPid;

  // Constants and state related to the topology.
  var TOPOLOGY_INTERVAL_MILLISECONDS = 1000;
  var FORWARD = 'fwrd';
  var BACKWARD = 'back';
  var direction = FORWARD;
  // The leader permanently holds the lock on the topology.
  var topology;
  var readySet = {};

  // Returns true if the topologies have the same leader, players,
  // and order of the players in both directions.
  // Otherwise returns false.
  function topologiesAreEqual(a, b) {
    // If the toplogies have different leaders, they're different.
    if (a.leader !== b.leader) return false;

    // If the topologies have different players, they're different.
    var aPlayers = Object.keys(a[FORWARD]).sort();
    var bPlayers = Object.keys(b[FORWARD]).sort();
    if (aPlayers.length !== bPlayers.length) return false;
    for (var i in aPlayers) {
      if (aPlayers[i] !== bPlayers[i]) return false;
    }

    // If the topologies have different ring links, they're different.
    return aPlayers.every(function (p) {
      return (a[FORWARD][p] === b[FORWARD][p]) &&
        (a[BACKWARD][p] === b[FORWARD][p]);
    });
  }

  // Regenerate the topology and return it.
  // This generates the topology in both directions (which makes
  // 'reverse' card logic easier).
  // TODO update this to use manual registration with the leader rather
  // than getting a list of processes from webrtc.
  function generateTopology() {
    // TODO use manual registration rather than WebRTC's peers.
    var peers = webrtc.getPeers();
    var pids = [myPid].concat(peers.map(function (p) { return p.id; }));

    // TODO Set all PENDING processs to be LIVE.
    //      Processes may be either PENDING, LIVE, or DEAD.
    //      DEAD processes must register with the leader to become PENDING.
    //      On the leader's turn, PENDING processes become LIVE again.

    // Completely recalculate the topology.
    // TODO Optimise to only recalculate stuff that changes.
    var topology = {};
    // Create the 'forward' topology based on the peer list.
    topology[FORWARD] = {};
    pids.sort().forEach(function (pid, i) {
      var iNext = (i + 1 >= pids.length) ? 0 : i + 1;
      topology[FORWARD][pid] = pids[iNext];
    });

    // The leader is always the process with the lowest pid.
    topology.leader = pids[0];

    // Create the 'backward' topology as the reverse of the
    // forwards topology.
    topology[BACKWARD] = {};
    for (var first in topology[FORWARD]) {
      var second = topology[FORWARD][first];
      topology[BACKWARD][second] = first;
    }

    Utility.assertSameItems(
        Object.keys(topology[FORWARD]), Object.keys(topology[BACKWARD]),
        'forwards and backwards topologies must have the same pids');

    return topology;
  }

  function render(topology) {
    RootComponent.setState({
      players: Object.keys(topology[FORWARD]),
      leader: topology.leader,
    });
  }

  var webrtc = new SimpleWebRTC({
    media: {
      video: false,
      audio: false,
    },
  });

  // ===== One-to-one connections =====
  //
  // pidMap is a map of process IDs (pids) to peers.
  //
  // The `createdPeer` is triggered:
  //
  // * when this process connects, for each other peer, and
  // * when a new peer connects to the network after this peer.
  //
  // This is promised by the SimpleWebRTC API.
  //
  // The createdPeer event handle adds the new peer to pidMap, defined above.
  // The sendToPid function sends a message:
  //
  // * to the peer with the specified pid (`targetPid`),
  // * in the specified `room`,
  // * with the specified message `type`,
  // * containing the specified content (`message`).

  var pidMap = {};
  webrtc.on('createdPeer', function (peer) {
    pidMap[peer.id] = peer;

    // Before initialisation there is no leader, so each process
    // should compute and display its own player list.
    if (!isInitialised) {
      console.log(generateTopology());
      render(generateTopology());
    }
  });

  function sendToPid(targetPid, room, type, message) {
    Utility.log('Sending to peer ' + targetPid);
    var peer = pidMap[targetPid];
    Utility.assert(peer !== undefined, 'target missing');
    peer.sendDirectly(room, type, message);
  }

  // TODO convert INITIALISE related logic into something better.
  var isInitialised = false;
  function initialise() {
    Utility.assert(!isInitialised, 'Network initialised twice');
    isInitialised = true;

    var peers = webrtc.getPeers();
    var pids = [myPid].concat(peers.map(function (p) { return p.id; }));
    Utility.log('Initial peer list is ' + pids.join(', '));

    // Choose the lowest myPid as the leader.
    Utility.log('My myPid is ' + myPid);
    var leader = pids.sort()[0];
    Utility.log('The leader is ' + leader);

    // Give the first turn to the leader.
    if (leader === myPid) {
      Utility.log("It's my turn first!");
      // Register this process as the initial leader before checking the
      // topology since only the leader may check it.
      topology = generateTopology();
      topology.leader = leader;
      broadcastTopology(topology);
      checkTopology();
      Application.onFirstTurn(myPid);
    }

    onJoin();
  }

  webrtc.on('readyToCall', function () {
    myPid = webrtc.connection.connection.id;
    Utility.log('My myPid is ' + myPid);

    webrtc.joinRoom(ROOM);
    webrtc.sendDirectlyToAll(ROOM, READY);
    // TODO Replace dodgy busy wait with something good.

    webrtc.on('channelMessage', function (peer, room, data, other) {
      switch (data.type) {
        case TOPOLOGY:
          Utility.logMessage(peer, 'TOPOLOGY', data.payload);
          onTopologyUpdate(data.payload);
          break;

        case TURN:
          Utility.logMessage(peer, 'TURN', data.payload);
          onTurnMessage(data.payload);
          break;

        case READY:
          Utility.logMessage(peer, 'READY', data.payload);
          if (isInitialised) {
            peer.sendDirectly(ROOM, PREINITIALISED, topology);
          } else {
            readySet[peer.id] = true;
            console.log(readySet);

            // TODO don't cheat
            var peers = webrtc.getPeers();
            var pids =
              [myPid].concat(peers.map(function(p) { return p.id; }));
            var mayInitialise = pids.every(function(pid) {
              return readySet[pid];
            });
            if (mayInitialise) {
              initialise();
              Application.initialise();
              peer.sendDirectly(ROOM, INITIALISE);
            }
          }
          break;

        case STATE:
          Utility.logMessage(peer, 'STATE', data.payload);
          Application.onUpdate(data.payload);

          // in case we missed the initialise but joined the room since
          if (!isInitialised) {
            initialise();
            Application.initialise();
          }
          break;

        case INITIALISE:
          // TODO convert INITIALISE related logic into something better.
          Utility.logMessage(peer, 'INITIALISE', data.payload);
          if (isInitialised) break;
          initialise();
          Application.initialise();
          break;

        case PREINITIALISED:
          // TODO convert INITIALISE related logic into something better.
          Utility.logMessage(peer, 'PREINITIALISED', data.payload);
          if (!isInitialised) {
            isInitialised = true;
            onJoin();
            Application.initialise();
          }
          // TODO Register with the leader
          break;

        case CARD_COUNT:
          Utility.logMessage(peer, 'CARD_COUNT', data.payload);
          Application.onUpdateCardCount(peer.id, data.payload);
          break;

        default:
          throw 'incomplete branch coverage in message handler switch statement';
      }
    });
  });

  // Called when the player readies up.
  function readyUp() {
    readySet[myPid] = true;
    // TODO convert INITIALISE related logic into something better.
    var peers = webrtc.getPeers();
    if (peers.length !== 0) {
      webrtc.sendDirectlyToAll(ROOM, READY);
    }
  }

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

  // Called when this process joins an existing game.
  function onJoin() {
    console.log('topology on join: ' + topology);
    // All processes should periodically check on the topology
    // if they are the leader.
    window.setInterval(function () {
      if (topology.leader === myPid) checkTopology();
    }, TOPOLOGY_INTERVAL_MILLISECONDS);
  }

  // Called at the leader process when a processs tries to join.
  function onJoinRequest() {
    // TODO
    // 1. Add the new process to the topology, as pending.
    // 2. Broadcast the new topology.
  }

  // If this process is the current leader, recomputes the topology.
  // If it has changed, the view is updated accordingly and everyone
  // is notified.
  function checkTopology() {
    Utility.assertEquals(topology.leader, myPid,
        'only the leader may check the topology');
    Utility.log("Checking the topology since I'm the leader");

    // 1. Generate the new topology.
    var newTopology = generateTopology();

    // 2. Remember and broadcast the new topology if it is different.
    if (!topologiesAreEqual(newTopology, topology)) {
      // If someone else is the new leader, then I wait until they
      // acknowledge it with their own topology broadcast before
      // I stop acting as the leader.
      if (newTopology.leader !== myPid) {
        sendToPid(newTopology.leader, ROOM, TOPOLOGY, newTopology);
        newTopology.leader = myPid;
      } else {
        topology = newTopology;
        render(newTopology);
        broadcastTopology(newTopology);
      }
    }
  }

  function broadcastTopology() {
    webrtc.sendDirectlyToAll(ROOM, TOPOLOGY, topology);
  }

  function broadcastState(newState) {
    webrtc.sendDirectlyToAll(ROOM, STATE, newState);
  }

  function broadcastCardCount(myCardCount) {
    webrtc.sendDirectlyToAll(ROOM, CARD_COUNT, myCardCount);
  }

  // Called when a process receives a topology update.
  function onTopologyUpdate(newTopology) {
    console.log('got topology ' + newTopology);
    // 1. Remember the topology.
    topology = newTopology;

    Utility.log('The leader is now ' + topology.leader);

    // 2. Update the state of the view by adding on the list of
    // players from the topology
    render(topology);
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

  function onTurnMessage(payload) {
    var newState = payload.newState;
    var turnType = payload.turnType;
    var nCardsToDraw = payload.nCardsToDraw;

    // Adhere to the direction which was passed to us.
    direction = payload.direction;

    if (!isInitialised) {
      endTurn(turnType, newState, nCardsToDraw);
      return;
    }

    // Accept the new turn.
    newState.turnOwner = myPid;

    // Draw cards if we're told to.
    if (nCardsToDraw) {
      Application.draw(nCardsToDraw);
      // TODO update our card count in `newState`.
    }

    // Update our local state and broadcast, after we updated
    // it with any card-draws we had to do.
    Application.onUpdate(newState);
    broadcastState(newState);

    // If we got skipped, give the turn to the next person,
    // otherwise take our turn.
    switch (turnType) {
      case TurnType.SKIP:
        endTurn(TurnType.NORMAL, newState);
        break;

      case TurnType.NORMAL:
        Application.onTurnReceived();
        break;

      // Note: REVERSE turn messages shouldn't actually be sent,
      // they should be converted to NORMAL messages with the direction
      // flipped.
      default:
        throw "Unknown turn type";
    }
  }

  // Ends the current player's turn, checks the topology to find
  // the next player, then sends the turn to the next player.
  function endTurn(turnType, newState, nCardsToDraw) {
    Utility.assert(newState.turnOwner === myPid,
        "tried to take a turn when it's not our turn");

    // Flip the turn direction if this is a reverse turn.
    var newDirection;
    if (turnType === TurnType.REVERSE) {
      turnType = TurnType.NORMAL;
      newDirection = (direction === FORWARD) ? BACKWARD : FORWARD;
    } else {
      newDirection = direction;
    }
    passTurn(turnType, newDirection, newState, nCardsToDraw);
  }

  function passTurn(turnType, newDirection, newState, nCardsToDraw) {
    var nextPlayer = topology[newDirection][myPid];
    sendToPid(nextPlayer, ROOM, TURN, {
      turnType: turnType,
      newState: newState,
      direction: newDirection,
      nCardsToDraw: nCardsToDraw,
    });
  }

  // === TODO Failure handling functions ===
  //
  // Not sure what the approach is here.
  //
  // Maybe handle it with a decorator around SimpleWebRTC?

  return {
    endTurn: endTurn,
    readyUp: readyUp,
    sendToPid: sendToPid,
    broadcastState: broadcastState,
    broadcastCardCount: broadcastCardCount,
    get players() {
      // return the forward format of the topology
      if (topology) {
        return Object.keys(topology[FORWARD]);
      } else {
        return [];
      }
    },
    get myId() {
      return myPid;
    },
  };
})();
