class WebComponent extends HTMLElement {
  connectedCallback() {
    eventBus.register('namespace:eventName', { type: 'boolean' });

    this.render();

    this.buttonValid = this.querySelector('button:nth-child(1)');
    this.buttonValid && this.buttonValid.addEventListener('click', this.sendValid);

    this.buttonInvalid = this.querySelector('button:nth-child(2)');
    this.buttonInvalid && this.buttonInvalid.addEventListener('click', this.sendInvalid);

    this.favorite = false;
  }

  sendValid() {
    this.favorite = !this.favorite;
    eventBus.publish('namespace:eventName', this.favorite);
  }

  sendInvalid() {
    try {
      eventBus.publish('namespace:eventName', { nested: true });
    } catch (e) {
      console.warn(e);
      console.debug('eventType:', e.eventType);
      console.debug('schema:', e.schema);
      console.debug('detail:', e.detail);
    }
  }

  render() {
    this.innerHTML = `
    <article style="margin-bottom: 2rem; padding: 1rem; background-color: YellowGreen">
      <header>Web Component</header>
      <p>
        <button type="button">Toggle favorite</button>
        <button type="button">Send invalid event</button>
      </p>
    </article>
    `;
  }

  disconnectedCallback() {
    this.buttonValid && this.buttonValid.removeEventListener('click', this.send);
    this.buttonInvalid && this.buttonInvalid.removeEventListener('click', this.send);
  }
}

customElements.define('web-component', WebComponent);
