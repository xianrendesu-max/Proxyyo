self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (url.origin === self.location.origin || url.href.includes('/p?u=')) return;

    const proxiedUrl = '/p?u=' + btoa(event.request.url);
    event.respondWith(
        fetch(proxiedUrl, {
            method: event.request.method,
            headers: event.request.headers,
            body: event.request.method !== 'GET' ? event.request.blob() : null,
            credentials: 'include'
        })
    );
});
