if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let updateInstalled = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateInstalled) return;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          // Only treat this as an "update" if a controller already exists.
          // First install also fires updatefound, but reloading then is just churn.
          if (!navigator.serviceWorker.controller) return;
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') updateInstalled = true;
          });
        });
      })
      .catch((err) => {
        console.warn('[sw] registration failed', err);
      });
  });
}
