# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Pegboard, please report it responsibly.

**Do not open a public issue.**

Email: **security@pegboard.dev** (or open a [private security advisory](https://github.com/pegboard-guild/pegboard/security/advisories/new) on GitHub).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Scope

- The Pegboard API and backend code
- Data ingestors (injection, path traversal, credential leaks)
- Neo4j query injection
- Dependency vulnerabilities

## Out of Scope

- Vulnerabilities in upstream government APIs
- Social engineering
- Denial of service against third-party services

## Supported Versions

| Version | Supported |
|---------|-----------|
| main branch | ✅ |
| Older releases | Best effort |

Thank you for helping keep civic infrastructure secure.
