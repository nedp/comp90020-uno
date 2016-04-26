var GameView = React.createClass({
  displayName: 'GameView',

  getInitialState: function () {
    return { message: 'Game initialising' };
  },
  render: function () {
    return React.createElement(
      'div',
      null,
      'Hello ',
      JSON.stringify(this.state),
      '!'
    );
  }
});

var RootComponent = ReactDOM.render(React.createElement(GameView, null), document.getElementById('reactDiv'));
