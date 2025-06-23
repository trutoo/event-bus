const e = React.createElement;

function useEventSubscription(eventName, schema) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    let sub;

    async function init() {
      try {
        eventBus.register(eventName, schema);
        sub = await eventBus.subscribe(eventName, (event) => setValue(event.payload));
      } catch (e) {
        console.warn(`Failed to subscribe to ${eventName}:`, e);
        console.debug('channel:', e.channel);
        console.debug('schema:', e.schema);
        console.debug('newSchema:', e.newSchema);
      }
    }

    init();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [eventName, schema]);

  return value;
}

function ReactComponent() {
  const isFavorite = useEventSubscription('namespace:eventName', { type: 'boolean' });
  // Re-registering again with another schema is not allowed
  useEventSubscription('namespace:eventName', { type: 'string' });

  return e(
    'article',
    { style: { padding: '1rem', backgroundColor: 'DeepSkyBlue' } },
    e('header', null, 'React Component'),
    e('p', null, isFavorite ? 'This is a favorite' : 'This is not interesting'),
  );
}

const domContainer = document.querySelector('#react-component');
ReactDOM.render(e(ReactComponent), domContainer);
