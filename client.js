(function(){
  const BROADCAST = 'all-peers';

  const webrtc = new SimpleWebRTC({
    media: {
      video: false,
      audio: false,
    },
  });

  // we have to wait until it's ready
  webrtc.on('readyToCall', () => {

    webrtc.joinRoom(BROADCAST);

    webrtc.on('channelMessage', function (peer, label, data) {
      console.log(peer);
      console.log(data);
      document.body.innerHTML += '<p>Peer ' + peer.id + ' sent us message: "' + data.payload + '"</p>';
    });

    setInterval(() => {
      webrtc.sendDirectlyToAll(BROADCAST, 'msg', 'Hello ' + Math.random());
    }, 5000 * (Math.random() + 1));
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
  const onJoin = () => {
    // TODO
    // 1. Request the current topology, and to join it.
  };

  // Called at the leader process when a processs tries to join.
  const onJoinRequest = () => {
    // TODO
    // 1. Add the new process to the topology, as pending.
    // 2. Broadcast the new topology.
  };

  // Called at the leader process before taking a turn.
  const onLeaderTurn = () => {
    // TODO
    // 1. Set all pending processs to be live.
    // 2. Broadcast the new topology.
  };

  // Called when a process receives a topology update.
  const onTopologyUpdate = () => {
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
  const onUpdate = () => {
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
  };

  // Called when the previous process passes the turn to us.
  const onTurn = () => {
    // TODO
    // 1. Allow the player to take their turn.
  };

  // Called when the previous process skips us.
  const onSkip = () => {
    // TODO
    // 1. Pass the turn to the next player.
  };

  // Called when another process tells this process to draw cards.
  //
  // This has nothing to do with taking a turn or holding the lock
  // on the game state.
  // Locally displayed cards are not part of the game state,
  // so no message has to be sent.
  const onDraw = () => {
    // TODO
    // 1. Choose, and add to the local hand, an appropriate number
    //    of cards.
  };

  // Called when the player takes their turn using the UI.
  const onTurnTaken = () => {
    // TODO
    // 1. Stop the player from taking a second turn.
    // 2. If I have only one card left, add me to the Uno list.
    // 3. If I have more than one card left, remove me from the Uno list.
    // 4. Broadcast the new update.
    // 5. Pass the turn to the next process.
  };

  // === Uno functions ===
  //
  // The approach here is to use the current turn-taker as a central
  // server for mutex on the Uno list, and as a sequencer for
  // TO-Multicasting of Uno/Gotcha calls.
  //
  // It might be better to pick a different approach.

  // Called when the player calls Uno via the UI.
  const onUnoButton = () => {
    // TODO
    // 1. Broadcast the uno message.
  };

  // Called when the player calls Gotcha via the UI.
  const onGotchaButton = () => {
    // TODO
    // 1. Broadcast the gotcha message.
  };

  // Called when another process sends us an Uno message.
  const onUnoMessage = () => {
    // TODO
    // 1. Disregard the message if it's not my turn,
    //    since I don't own the state.
    // 2. Remove the player who called Uno from the Uno list.
    // 3. Broadcast the new state.
  };

  // Called when another process sends us a Gotcha message.
  const onGotchaMessage = () => {
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
