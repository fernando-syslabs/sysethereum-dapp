class GlobalStateManager {
  /**
   * Create or retrieve a global state namespace.
   * @param {string} namespace
   */
  constructor(namespace) {
    if (typeof window === 'undefined') {
      throw new Error("GlobalStateManager can only be used in a browser environment.");
    }
    if (!namespace || typeof namespace !== 'string') {
      throw new Error("GlobalStateManager requires a valid namespace string.");
    }

    this.namespace = namespace;

    // Initialize state object on window
    if (!window[namespace]) {
      window[namespace] = {};
      console.log(`Initialized global state namespace: ${namespace}`);
    }
  }

  /**
   * Get a value from state
   */
  get(key) {
    return window[this.namespace][key];
  }

  /**
   * Set a value in state (no notifications)
   */
  set(key, value) {
    window[this.namespace][key] = value;
  }

  /**
   * Merge updates into state (no notifications)
   */
  setState(updates) {
    if (typeof updates !== 'object' || updates === null) {
      throw new Error(`setState requires an object, received: ${typeof updates}`);
    }
    Object.assign(window[this.namespace], updates);
  }

  /**
   * Get the entire state object
   */
  getState() {
    return window[this.namespace];
  }
}

export default GlobalStateManager;
