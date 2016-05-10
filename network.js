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

  // Maximum time allowed between checks
  var MAX_CHECK_INTERVAL = 30000;
  // Minimum time between checks
  var MIN_CHECK_INTERVAL = 2000;
  // checkInterval == CHECK_FACTOR * responseTime
  var CHECK_FACTOR = 3;

  // Message types.
  var TOPOLOGY = 'top';
  var TURN = 'turn';
  var STATE = 'state';
  var INITIALISE = 'init';
  var PREINITIALISED = 'pre-init';
  var CHECK = 'check';
  var CHECK_RESP = 'resp';
  var NODE_FAIL = 'fail';
  var ZOMBIE_NODE = 'zombie';

  // myPid uniquely identifies this process.
  var myPid;

  // Constants and state related to the topology.
  var FORWARD = 'fwrd';
  var BACKWARD = 'back';
  var direction = FORWARD;

  // The leader permanently holds the lock on the topology.
  var leader = null;
  var topology = {};
  var failed = {};

  var CheckState =
    {
      neighbour:  null,
      checkTimeoutHandler: null,
      // true -> Stop neighbour being removed from the ring on the first call
      hasReceivedResponse: true,
      checkInterval: MAX_CHECK_INTERVAL,
    };

  // Regenerate the topology, save it locally, and update the view.
  // This generates the topology in both directions (which makes
  // 'reverse' card logic easier).
  function generateTopology() {
    // TODO use manual registration rather than WebRTC's peers.
    var peers = webrtc.getPeers();
    var pids = [myPid].concat(peers.map(function (p) { return p.id; }));

    // Completely recalculate the topology.
    // TODO Optimise to only recalculate stuff that changes.
    topology = {};

    // Create the 'forward' topology based on the peer list.
    topology[FORWARD] = {};
    pids.sort().forEach(function (pid, i) {
      var iNext = (i + 1 >= pids.length) ? 0 : i + 1;
      topology[FORWARD][pid] = pids[iNext];
    });

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

    // O(n) but doesn't matter because rendering logic is O(n) anyway.
    renderPlayers(topology);
  }

  function renderPlayers(topology) {
    RootComponent.setState({ players: Object.keys(topology[FORWARD]) });
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

    if (!isInitialised) {
      generateTopology();

      // Add on the list of players from the topology
      renderPlayers(topology);
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
    leader = myPid;
    pids.forEach(function (pid) {
      if (pid < leader) leader = pid;
    });
    Utility.log('The leader is now ' + leader);

    // Give the first turn to the leader.
    if (leader === myPid) {
      Utility.log('It\'s my turn first!');
      onLeaderTurn();
      Application.onFirstTurn(myPid);
    }
  }

  webrtc.on('readyToCall', function () {
    myPid = webrtc.connection.connection.id;
    Utility.log('My myPid is ' + myPid);

    webrtc.joinRoom(ROOM);
    webrtc.sendDirectlyToAll(ROOM, INITIALISE);
    // TODO Replace dodgy busy wait with something good.

    webrtc.on('channelMessage', function (peer, room, data, other) {
      if (failed[peer.id]) {
        sendToPid(leader, ROOM, ZOMBIE_NODE, { zombiePid: peer.id });
        return;
      }

      switch (data.type) {
        case TOPOLOGY:
          Utility.logMessage(peer, 'TOPOLOGY', data.payload);
          onTopologyUpdate(data.payload);
          break;

        case TURN:
          Utility.logMessage(peer, 'TURN', data.payload);

          var newState = data.payload.newState;
          var turnType = data.payload.turnType;
          Utility.assert(newState.turnOwner === myPid,
              'received a turn with the wrong pid');

          // Update our local state
          Application.onUpdate(data.payload.newState);

          // Broadcast the state to everyone now that we know we have
          // successfully made it to our turn
          webrtc.sendDirectlyToAll(ROOM, STATE, data.payload.newState);

          if (leader === myPid) {
            onLeaderTurn();
          }

          // If we got skipped, give the turn to the next person,
          // otherwise take our turn.
          if (turnType === TurnType.SKIP) {
            endTurn(turnType.NORMAL, newState);
          } else {
            Utility.assertEquals(TurnType.NORMAL, turnType,
                'turns must have a known type');
            Application.onTurnReceived(newState);
          }

          break;

        case STATE:
          Utility.logMessage(peer, 'STATE', data.payload);
          Application.onUpdate(data.payload);
          break;

        case INITIALISE:
          // TODO convert INITIALISE related logic into something better.
          Utility.logMessage(peer, 'INITIALISE', data.payload);
          if (isInitialised) {
            peer.sendDirectly(ROOM, PREINITIALISED);
            if (leader === myPid) {
              broadcastTopology();
            }
          } else {
            initialise();
            Application.initialise();
            peer.sendDirectly(ROOM, INITIALISE);
          }
          break;

        case PREINITIALISED:
          // TODO convert INITIALISE related logic into something better.
          Utility.logMessage(peer, 'PREINITIALISED', data.payload);
          // TODO Register with the leader.
          break;

        case CHECK:
          Utility.logMessage(peer, 'CHECK', data.payload);
          peer.sendDirectly(ROOM, CHECK_RESP);
          break;

        case CHECK_RESP:
          Utility.logMessage(peer, 'CHECK_RESP', data.payload);
          receiveNeighbourResponse();
          setTimeout(function () {
            checkNeighbour(peer.id);
          }, CheckState.checkInterval);
          break;

        case NODE_FAIL:
          Utility.logMessage(peer, 'NODE_FAIL', data.payload);
          if (leader === myPid) {
            // Tell all nodes that the node has failed
            webrtc.sendDirectlyToAll(ROOM, NODE_REMOVE,
                                     { failedPid: failedPid });
            // Take side effects out here
            topology = handleNodeFailure(peer.id, data.payload, topology);
            failed[failedPid] = true;
            broadcastTopology();
          }
          break;

        case NODE_REMOVE:
          Utility.logMessage(peer, 'NODE_REMOVE', data.payload);
          failed[data.payload.failedPid] = true;
          break;

        case ZOMBIE_NODE:
          Utility.logMessage(peer, 'ZOMBIE_NODE', data.payload);
          if (leader === myPid) {
            // TODO Rejoin the Zombie into the game
            // by issuing a topology message
          }
          break;

        default:
          throw 'incomplete branch coverage in message handler switch statement';
      }
    });
  });

  // Called when the player readies up.
  function requestStart() {
    // TODO convert INITIALISE related logic into something better.
    var peers = webrtc.getPeers();
    if (peers.length !== 0) {
      webrtc.sendDirectlyToAll(ROOM, INITIALISE);
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
    // TODO
    // 1. Request the current topology, and to join it.
  }

  // Called at the leader process when a processs tries to join.
  function onJoinRequest() {
    // TODO
    // 1. Add the new process to the topology, as pending.
    // 2. Broadcast the new topology.
  }

  // Called at the leader process before taking a turn.
  function onLeaderTurn() {
    Utility.log('Taking turn as leader.');

    // TODO 1. Set all PENDING processs to be LIVE.
    //         Processes may be either PENDING, LIVE, or DEAD.
    //         DEAD processes must register with the leader to become PENDING.
    //         On the leader's turn, DEAD processes become LIVE again.

    // Until registration and process states are implemented, just cheat
    // by getting a peer list from webrtc.
    var peers = webrtc.getPeers();
    var pids = [myPid].concat(peers.map(function (p) { return p.id; }));
    generateTopology(pids);
    leader = pids[0];

    // 2. Broadcast the new topology.
    broadcastTopology();
  }

  function broadcastTopology() {
    webrtc.sendDirectlyToAll(ROOM, TOPOLOGY, {
      leader: leader,
      topology: topology,
    });
  }

  // Called when a process receives a topology update.
  function onTopologyUpdate(payload) {
    // 1. Remember the topology.
    leader = payload.leader;
    topology = payload.topology;

    // TODO Decide if failure checks in forward topology are sufficient
    var neighbour = topology[FORWARD][myPid];
    startNeighbourCheck(neighbour);

    Utility.log('The leader is now ' + leader);

    // 2. Update the state of the view by adding on the list of
    // players from the topology
    renderPlayers(topology);
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

  // Ends the current player's turn, checks the topology to find
  // the next player, then sends the turn to the next player.
  function endTurn(turnType, newState) {
    Utility.assert(newState.turnOwner === myPid,
        "tried to take a turn when it's not our turn");

    var nextPlayer = topology[direction][myPid];
    newState.turnOwner = nextPlayer;
    sendToPid(nextPlayer, ROOM, TURN, {
      turnType: turnType,
      newState: newState,
    });
  }

  // === TODO Failure handling functions ===
  //
  // Not sure what the approach is here.
  //
  // Maybe handle it with a decorator around SimpleWebRTC?
  
  // Ping the next/neighbouring node to find out if it's alive
  // If they haven't responded since last ping, assume they have failed
  function checkNeighbour(neighbourPid) {
    if (!CheckState.hasReceivedResponse) {
      handleNeighbourFailure();
      return;
    }
    CheckState.hasReceivedResponse = false;
    CheckState.checkInterval = new Date();
    sendToPid(neighbourPid, ROOM, CHECK);
  }

  // Document receipt of a ping response from a neighbour
  function receiveNeighbourResponse() {
    CheckState.hasReceivedResponse = true;
    var newInterval = CHECK_FACTOR * (new Date() - CheckState.checkInterval);
    if (newInterval < MAX_CHECK_INTERVAL) {
      if (newInterval > MIN_CHECK_INTERVAL) {
        CheckState.checkInterval = newInterval;
      }
      CheckState.checkInterval = MIN_CHECK_INTERVAL;
    }
    else {
      CheckState.checkInterval = MAX_CHECK_INTERVAL;
    }
  }

  // Override waiting for neighbour response checking when topology changes
  function startNeighbourCheck(newNeighbour) {
    if (CheckState.checkTimeoutHandler !== null) {
      clearTimeout(CheckState.checkTimeoutHandler);
    }
    CheckState.neighbour = newNeighbour;
    checkNeighbour(newNeighbour);
  }

  // Tell the leader that this node's neighbour has failed
  function handleNeighbourFailure() {
    alert(CheckState.neighbour + ' has failed!');
    Utility.log('*** NODE FAIL *** -- My neighbour ' +
                CheckState.neighbour +
                ' has failed!');
    sendToPid(leader, ROOM, NODE_FAIL, CheckState.neighbour);
    clearInterval(CheckState.checkIntervalHandler);
  }

  // As the leader: handle the failure of a node
  // This should close the ring over the failed node:
  //   2 -- 3          2 -- 3          2 -- 3
  //  /      \        /      \        /     |
  // 1        4  =>  1        X  =>  1      |
  //  \      /        \      /        \     |
  //   6 -- 5          6 -- 5          6 -- 5
  function handleNodeFailure(reporterPid, failedPid, topology) {
    // Delete the node from the topology, but remember in case it returns
    topology[reporterPid] = topology[failedPid];
    delete topology[failedPid];
  }

  return {
    endTurn: endTurn,
    requestStart: requestStart,
    sendToPid: sendToPid,
    get leader() {
      return leader;
    },
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  'use strict';
});
