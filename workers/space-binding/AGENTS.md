# ALOHA Space Binding

Private product-state service, not LifeSpace authority. Only trusted ALOHA BFF Service Bindings invoke it. Store one pointer or creation reservation per verified LifeSpace user, never credentials, profile or domain records. No public route, no automatic creation or retries, no cross-environment binding. Callers verify current membership and Identity before invoking it. Serialize changes and require revision compare-and-set. Never log identifiers or input.
