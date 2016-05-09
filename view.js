var GameView = React.createClass({
  displayName: 'GameView',

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
        players.push(React.createElement(PlayerView, { key: value,
          takingTurn: this.state.turnOwner === value,
          playerId: value,
          idx: ++cntPlayers }));
      }.bind(this));
    }

    var ReadyUpButton = '';
    if (!this.state.isInitialised && this.state.players && this.state.players.length > 0) {
      ReadyUpButton = React.createElement(
        'div',
        { onClick: Application.readyUp,
          className: 'btn btn-default' },
        'Ready!'
      );
    } else if (!this.state.isInitialised) {
      ReadyUpButton = React.createElement(
        'div',
        null,
        'Finding peers... Share the URL!'
      );
    }

    var DrawButton = '';
    if (this.state.isInitialised && this.state.isMyTurn && !this.state.requestSpecial) {
      DrawButton = React.createElement(
        'div',
        { onClick: Application.pickupCard,
          className: 'btn btn-primary turnButton' },
        'Pick up card'
      );
    }

    var cancelSuiteSelection = null;
    var myHandCards = [];
    var idx = 0;
    if (this.state.requestSpecial) {
      // the suite selection of the wild card I am playing
      var card = CardFetcher.fromUrl(this.state.requestSpecial.type);
      Object.keys(CardFetcher.SUIT).forEach(function (suite) {
        var specificCard = CardFetcher.create(card.type, CardFetcher.SUIT[suite]);
        myHandCards.push(React.createElement(CardView, { key: idx++ + specificCard.toUrl(),
          card: specificCard }));
      });
      // special button for cancelling the suite selection
      cancelSuiteSelection = React.createElement(
        'div',
        { onClick: Application.cancelSuiteSelection,
          className: 'btn btn-default' },
        'Cancel Selection'
      );
    } else {
      // the cards in my hand
      this.state.myHand.forEach(function (card) {
        myHandCards.push(React.createElement(CardView, { key: idx++ + card.toUrl(), card: card }));
      });
    }

    // show the top card if it's there
    var topCard = null;
    if (this.state.topCard) {
      topCard = React.createElement(CardView, { card: this.state.topCard });
    }

    return React.createElement(
      'div',
      null,
      React.createElement(
        'h4',
        null,
        'Players'
      ),
      React.createElement(
        'div',
        null,
        players
      ),
      ReadyUpButton,
      React.createElement(
        'h4',
        null,
        'Top Card'
      ),
      React.createElement(
        'div',
        { className: 'topCard' },
        topCard,
        DrawButton
      ),
      React.createElement(
        'h4',
        null,
        'Current Hand'
      ),
      React.createElement(
        'div',
        { className: 'myHand' + (this.state.requestSpecial ? ' specialPicker' : '') + (this.state.isMyTurn ? '  isMyTurn' : ' isNotMyTurn') },
        myHandCards,
        cancelSuiteSelection
      )
    );
  }
});

var CardView = React.createClass({
  displayName: 'CardView',

  render: function () {
    return React.createElement('img', { src: 'cards/' + this.props.card.toUrl() + '.svg',
      onClick: Application.playCard.bind(undefined, this.props.card),
      className: 'card' });
  }
});

var PlayerView = React.createClass({
  displayName: 'PlayerView',

  render: function () {
    var playerClass = this.props.takingTurn ? 'takingTurn' : 'notTakingTurn';

    return React.createElement(
      'div',
      null,
      React.createElement(
        'p',
        { className: playerClass },
        'Player ',
        this.props.idx,
        ' (',
        this.props.playerId,
        ')'
      )
    );
  }
});

var RootComponent = ReactDOM.render(React.createElement(GameView, null), document.getElementById('reactDiv'));
