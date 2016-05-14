var GameView = React.createClass({
  displayName: "GameView",

  // initial state of the view
  getInitialState: function () {
    return { message: 'Game initialising', myHand: [] };
  },
  // render function for the view
  render: function () {
    var players = [];
    var cntPlayers = 0;
    if (this.state.players) {
      this.state.players.forEach(function (value) {
        // what is their card count
        var cardCount = null;
        if (this.state.cardCounts) {
          cardCount = this.state.cardCounts[value];
        }
        // whether or not to show if they said uno (they are safe)
        var showSafe = false;
        if (cardCount && cardCount === 1 && this.state.unoSet && !this.state.unoSet[value] || this.state.unoSafe && this.state.unoSafe[value]) {
          showSafe = true;
        }
        // have we readied up
        var isReady = this.state.ready && this.state.ready[value];
        players.push(React.createElement(PlayerView, { key: value,
          takingTurn: this.state.turnOwner === value,
          playerId: value,
          winner: value === this.state.winner,
          cardCount: cardCount,
          showSafe: showSafe,
          isReady: isReady,
          idx: ++cntPlayers }));
      }.bind(this));
    }

    var ReadyUpButton = null;
    if (!this.state.isInitialised && this.state.players && this.state.players.length > 0) {
      ReadyUpButton = React.createElement(
        "div",
        { onClick: Application.readyUp,
          className: "btn btn-default" },
        "Ready!"
      );
    } else if (!this.state.isInitialised) {
      ReadyUpButton = React.createElement(
        "div",
        null,
        "Finding peers... Share the URL!"
      );
    }

    var DrawButton = null;
    var UnoButton = null;
    if (this.state.isInitialised && this.state.isMyTurn && !this.state.requestSpecial) {
      DrawButton = React.createElement(
        "div",
        { onClick: Application.pickupCard,
          className: "btn btn-primary turnButton" },
        "Pick up card"
      );
    }

    // only draw the uno button if we have 1 card right now
    if (this.state.myHand.length === 1 && this.state.timeTakenToUno === null) {
      UnoButton = React.createElement(
        "div",
        { onClick: Application.onUnoButton,
          className: "btn btn-success unoButton" },
        "Uno"
      );
    }

    var cancelSuiteSelection = null;
    var myHandCards = [];
    var idx = 0;
    if (this.state.requestSpecial) {
      // the suite selection of the wild card I am playing
      var card = CardFetcher.fromString(this.state.requestSpecial.type);
      Object.keys(CardFetcher.SUIT).forEach(function (suite) {
        var specificCard = CardFetcher.create(card.type, CardFetcher.SUIT[suite]);
        myHandCards.push(React.createElement(CardView, { key: idx++ + specificCard.toString(),
          card: specificCard }));
      });
      // special button for cancelling the suite selection
      cancelSuiteSelection = React.createElement(
        "div",
        { onClick: Application.cancelSuitSelection,
          className: "btn btn-default" },
        "Cancel Selection"
      );
    } else {
      // the cards in my hand
      this.state.myHand.forEach(function (card) {
        myHandCards.push(React.createElement(CardView, { key: idx++ + card.toString(), card: card }));
      });
    }

    // show the top card if it's there
    var topCard = null;
    if (this.state.topCard) {
      topCard = React.createElement(CardView, { card: this.state.topCard });
    }

    return React.createElement(
      "div",
      null,
      React.createElement(
        "h4",
        null,
        "Players"
      ),
      React.createElement(
        "table",
        null,
        React.createElement(
          "tbody",
          null,
          players
        )
      ),
      ReadyUpButton,
      React.createElement(
        "h4",
        null,
        "Top Card"
      ),
      React.createElement(
        "div",
        { className: "topCard" },
        topCard,
        DrawButton,
        UnoButton
      ),
      React.createElement(
        "h4",
        null,
        "Current Hand"
      ),
      React.createElement(
        "div",
        { className: 'myHand' + (this.state.requestSpecial ? ' specialPicker' : '') + (this.state.isMyTurn ? '  isMyTurn' : ' isNotMyTurn') },
        myHandCards,
        cancelSuiteSelection
      )
    );
  }
});

var CardView = React.createClass({
  displayName: "CardView",

  render: function () {
    return React.createElement("img", { src: 'cards/' + this.props.card.toString() + '.svg',
      onClick: Application.playCard.bind(undefined, this.props.card),
      className: "card" });
  }
});

var PlayerView = React.createClass({
  displayName: "PlayerView",

  render: function () {
    var turnClass = this.props.takingTurn ? 'takingTurn' : 'notTakingTurn';

    var cardCountLabel = null;
    var readyLabel = null;
    var gotchaLabel = null;
    var safeLabel = null;
    if (this.props.cardCount !== null && this.props.cardCount >= 0) {
      cardCountLabel = React.createElement(
        "span",
        { className: "label label-primary cardCount" },
        this.props.cardCount
      );
      // don't show gotcha labels when someone has won
      if (!this.props.winner) {
        gotchaLabel = React.createElement(
          "span",
          { className: "btn btn-sm btn-primary",
            onClick: Application.onGotchaButton.bind(null, this.props.playerId) },
          "Gotcha!"
        );
      }
      // show the safe label so we know they have said uno
      if (this.props.showSafe) {
        safeLabel = React.createElement(
          "span",
          { className: "label label-success" },
          "SAFE"
        );
      }
    } else if (this.props.isReady) {
      readyLabel = React.createElement(
        "span",
        { className: "label label-primary" },
        "READY"
      );
    }

    var winnerLabel = null;
    if (this.props.winner) {
      winnerLabel = React.createElement(
        "span",
        { className: "label label-success" },
        "WINNER!"
      );
    }

    var meLabel = null;
    if (this.props.playerId === Network.myId) {
      meLabel = React.createElement(
        "span",
        { className: "label label-info" },
        "ME"
      );
    }

    return React.createElement(
      "tr",
      { className: 'player ' + turnClass },
      React.createElement(
        "td",
        null,
        meLabel
      ),
      React.createElement(
        "td",
        null,
        "Player ",
        this.props.idx
      ),
      React.createElement(
        "td",
        null,
        readyLabel,
        cardCountLabel,
        safeLabel
      ),
      React.createElement(
        "td",
        null,
        "(",
        this.props.playerId,
        ")"
      ),
      React.createElement(
        "td",
        null,
        gotchaLabel,
        winnerLabel
      )
    );
  }
});

var RootComponent = ReactDOM.render(React.createElement(GameView, null), document.getElementById('reactDiv'));
