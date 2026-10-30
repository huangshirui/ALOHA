/**
 * Temporary root-hosted Assistant PWA may serve its offline shell only for /.
 * Other first-party surfaces have their own independently routed Workers.
 * Move this allowlist with the Assistant when /assistant/ is activated.
 */
export const assistantNavigationFallbackAllowlist: RegExp[] = [/^\/$/]
