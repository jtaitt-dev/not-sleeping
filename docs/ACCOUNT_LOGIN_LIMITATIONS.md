# Account login limitations

Signing into ChatGPT or Claude in a browser does not grant this extension API
access. Not Sleeping does not scrape account sessions, cookies, subscriptions,
or authenticated provider pages.

OpenAI features require a user-supplied OpenAI API project key. Anthropic
features require a user-supplied Anthropic Console API key. Chat product plans
and API billing are separate provider products.

An account-login or delegated authorization flow may be added only if the
provider publishes a third-party flow suitable for this extension, the app can
be registered, scopes and revocation are clear, and a security review is
completed. Until then, BYOK is the explicit boundary.
