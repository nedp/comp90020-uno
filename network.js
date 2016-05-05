// The public interface to the network layer of the system.
var Network = (function() {

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

  var myPid;
  var isInitialised = false;
  var leader = null;
  var topology = {};

  // Regenerate the topology, save it locally, and update the view.
  function generateTopology() {
    var peers = webrtc.getPeers();
    var pids = [myPid].concat(peers.map(function(p) { return p.id; }));

    topology = {};
    pids.sort().forEach(function (pid, i) {
      var iNext = (i + 1 >= pids.length) ? 0 : i + 1;
      topology[pid] = pids[iNext];
    });

    RootComponent.setState({ players: Object.keys(topology) });
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
      RootComponent.setState({ players: Object.keys(topology) });
    }
  });

  function sendToPid(targetPid, room, type, message) {
    Utility.log('Sending to peer ' + targetPid);
    var peer = pidMap[targetPid];
    Utility.assert(peer !== undefined, 'target missing');
    peer.sendDirectly(room, type, message);
  };

  // TODO convert INITIALISE related logic into something better.
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
  };

  webrtc.on('readyToCall', function () {
    myPid = webrtc.connection.connection.id;
    Utility.log('My myPid is ' + myPid);

    webrtc.joinRoom(ROOM);
    webrtc.sendDirectlyToAll(ROOM, INITIALISE);
    // TODO Replace dodgy busy wait with something good.

    webrtc.on('channelMessage', function (peer, room, data, other) {
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

          Application.onTurnReceived(turnType, newState);

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

    Utility.log('The leader is now ' + leader);

    // 2. Update the state of the view by adding on the list of
    // players from the topology
    RootComponent.setState({ players: Object.keys(topology) });
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

  function endTurn(turnType, newState) {
    console.log(myPid);
    console.log(turnType);
    console.log(newState);

    Utility.assert(newState.turnOwner === myPid,
        "tried to take a turn when it's not our turn");
    newState.turnOwner = topology[myPid];

    sendToPid(topology[myPid], ROOM, TURN, {
      turnType: turnType,
      newState: newState
    });
  }

  // === TODO Failure handling functions ===
  //
  // Not sure what the approach is here.
  //
  // Maybe handle it with a decorator around SimpleWebRTC?

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
