const e = React.createElement;

function ReactComponent() {
  const [isFavorite, setFavorite] = React.useState(false);

  React.useEffect(() => {
    function handleSubscribe(favorite) {
      setFavorite(favorite);
    }

    eventBus.register('namespace:eventName', { type: 'boolean' });
    const sub = eventBus.subscribe('namespace:eventName', handleSubscribe);

    try {
      // Re-registering again with another schema is not allowed
      eventBus.register('namespace:eventName', { type: 'string' });
    } catch (e) {
      console.warn(e);
      console.debug('eventType:', e.eventType);
      console.debug('schema:', e.schema);
      console.debug('newSchema:', e.newSchema);
    }

    return function cleanup() {
      sub.unsubscribe();
    };
  }, []);

  return e('article', { style: { padding: '1rem', backgroundColor: 'DeepSkyBlue' } },
    e('header', null, 'React Component'),
    e('p', null, isFavorite ? 'This is a favorite' : 'This is not interesting')
  )
}

const domContainer = document.querySelector('#react-component');
ReactDOM.render(e(ReactComponent), domContainer);
