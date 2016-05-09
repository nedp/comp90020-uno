var GameView = React.createClass({
  // initial state of the view
  getInitialState: function () {
    return {message: 'Game initialising', myHand: []};
  },
  // render function for the view
  render: function () {
    var players = [];
    if (this.state.players) {
      this.state.players.forEach(function (value) {
        players.push(<PlayerView key={value} playerId={value} game={this.state}></PlayerView>);
      }.bind(this));
    }

    var ReadyUpButton = '';
    if (!this.state.isInitialised &&
        this.state.players &&
        this.state.players.length > 0) {
      ReadyUpButton = <div onClick={Application.readyUp}
                           className="btn btn-default">
                        Ready!
                      </div>;
    } else if (!this.state.isInitialised) {
      ReadyUpButton = <div>Finding peers... Share the URL!</div>;
    }

    var TurnButton = '';
    if (this.state.isInitialised && this.state.isMyTurn) {
      TurnButton = <div onClick={Application.onTurnTaken}
                           className="btn btn-primary">
                        Take a turn!
                      </div>;
    }

    // the cards in my hand
    var myHandCards = [];
    var idx = 0;
    this.state.myHand.forEach(function (card) {
      myHandCards.push(<CardView key={idx++ + card.toUrl()} card={card}></CardView>);
    });

    // show the top card if it's there
    var topCard = null;
    if (this.state.topCard) {
      topCard = <CardView card={this.state.topCard}></CardView>;
    }

    return <div>
             <div class='stateDiv'>
               State: {JSON.stringify(this.state)}!
             </div>
             { TurnButton }
             { ReadyUpButton }
             <div>{players}</div>
             <div>{topCard}</div>
             <div class='topCard'>
               {}
             </div>
             <div class='myHand'>
               { myHandCards }
             </div>
           </div>;
  },
});

var CardView = React.createClass({
  render: function () {
    return <img src={'cards/' + this.props.card.toUrl() + '.svg'} className='card'></img>;
  },
});

var PlayerView = React.createClass({
  render: function () {
    var playerClass = 'notTakingTurn';
    if (this.props.game.whosTurn && this.props.playerId === this.props.game.whosTurn) {
      playerClass = 'takingTurn';
    }

    return <div>
             <p className={playerClass}>{this.props.playerId}</p>
           </div>;
  },
});

var RootComponent = ReactDOM.render(<GameView />, document.getElementById('reactDiv'));
