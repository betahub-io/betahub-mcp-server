# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2026-08-12

### Added
- `listIssueAttachments` tool — lists an issue's screenshots, video clips, log files and binary files as download URLs, fanning out in parallel to the four nested per-issue endpoints (read-only). Each file gets a forced-download URL (the CDN link plus the `?download=<filename>` marker the CloudFront viewer-response function turns into `Content-Disposition: attachment`). Screenshot annotation layers are surfaced as their own downloadable files, and an annotated screenshot's size is labelled "combined" because the API sums the image and layer blobs; video clips that failed to transcode or are still processing are flagged so callers do not download an unusable file; attachments with no blob are reported as such rather than as a broken link. The tool returns links, not file contents — its description says so, so hosts that cannot fetch URLs do not report success on nothing.

## [0.9.0] - 2026-06-12

### Added
- `listCustomFields` tool — lists a project's custom fields merged across bugs and suggestions, flagging which fields are aggregatable across both entity types (read-only)
- `aggregateCustomField` tool — ranks bugs and suggestions by a custom field value (e.g. top contributors by `roblox_id`) with a per-type breakdown; developer-gated (`issues.merge`)
- Read-only annotations (`readOnlyHint`/`idempotentHint`/`openWorldHint`) on every tool, so clients can reason about side effects and auto-approve safely

### Changed
- `createServer` now registers tools from the central tool registry instead of hand-wiring each one, guarded by an integration test asserting the registered set matches the registry

### Fixed
- 404/403 error mapping across all tools now keys off `ApiError.statusCode` instead of an `error.message.includes('404')` substring check that never matched real API responses — so `NotFoundError`/`AccessDeniedError` were never actually thrown for genuine 404/403s
- `aggregateCustomField` escapes `|` and newlines in custom-field values so they cannot corrupt the rendered markdown table

## [0.8.0] - 2026-06-02

### Fixed
- `findSimilarIssues` now reads the API's `similarity_score` field instead of the issue's own `score` column. The deployed backend changed `find_similar.json` to return the full issue object (with its own `score` as a decimal string) plus a separate `similarity_score`; the tool had been surfacing the wrong value.

### Added
- `findSimilarIssues` now returns enriched issue objects (description, status, priority, `scoped_id`, etc.) instead of only id/title/url
- `includeArchived` parameter for `findSimilarIssues` (sent as `include_archived=true`); archived issues are excluded by default
- `fields` and `maxFieldLength` parameters for `findSimilarIssues`, consistent with `listIssues`/`searchIssues`
- `scoped_id` added to the shared issue field set, so `listIssues`/`searchIssues`/`findSimilarIssues` all expose it (the `find_similar` API resolves issues by scoped ID, not the numeric ID)

### Changed
- `findSimilarIssues` 403 errors now indicate the endpoint requires developer-level access

## [0.7.0] - 2026-05-14

### Added
- `fields` parameter for `listIssues` and `searchIssues` tools — select which fields to include in each issue (e.g., `["id", "title", "status", "url"]` for a compact list)
- `maxFieldLength` parameter for `listIssues` and `searchIssues` — configure max characters for long text fields (default: 300, set 0 for no truncation)
- Shared `issueFormatter` utility for consistent field filtering and truncation across issue tools

### Changed
- `listIssues` and `searchIssues` now truncate `description`, `steps_to_reproduce`, and `potential_duplicate` to 300 characters by default to reduce response payload size
- `searchIssues` multi-result responses now use field mapping instead of passing raw API responses

### Fixed
- `searchIssues` no longer leaks the `token` field in responses (both multi-result and scopedId lookups)

## [0.6.0] - 2026-01-26

### Added
- `findSimilarIssues` tool for AI-powered semantic duplicate detection using vector similarity search
- AWS Lambda deployment with Streamable HTTP transport (hosted at `mcp.betahub.io`)
- Per-request authentication via `Authorization` header for Lambda endpoint
- SAM template for infrastructure deployment

## [0.5.0] - 2026-01-26

### Changed
- **BREAKING:** Renamed issue status `'new'` to `'open'` to align with backend API changes

## [0.4.0] - 2026-01-26

### Changed
- **BREAKING:** Removed `partial` parameter from `searchSuggestions` and `searchIssues` tools

## [0.3.0] - 2025-11-27

### Added
- New `listIssueTags` tool to discover and list issue tags from projects
- `tagIds` filter parameter for `listIssues` tool to filter issues by tags
- Orphaned tag detection - warns when tags reference non-existent parent tags
- Parent/child tag grouping in `listIssueTags` output
- 13 new unit tests for issue tags functionality (150 total tests)

### Changed
- Centralized `IssueTag` and `IssueTagsResponse` types in `betahub.ts`
- Updated package description and keywords

## [0.2.0] - 2025-11-24

### Added
- Date filters for `listIssues` and `listSuggestions` tools:
  - `createdAfter` / `createdBefore` - filter by creation date
  - `updatedAfter` / `updatedBefore` - filter by last update date
- `wont_fix` and `needs_more_info` status filters for issues

## [0.1.0] - 2025-11-24

### Added
- `listReleases` tool to list project releases with download links
- Comprehensive test suite with 80+ unit and integration tests
- Modular architecture with clean separation of concerns

### Changed
- Major refactoring to modular codebase structure
- Improved error handling with custom error classes
- Type-safe implementation with full TypeScript types

## [0.0.4] - 2025-09-27

### Added
- `listIssues` tool to list bug reports from projects
- `searchIssues` tool to search issues by query or scoped ID
- Status and priority filters for issues

## [0.0.3] - 2025-09-27

### Added
- `searchSuggestions` tool to search feature requests
- Scoped ID lookup for specific feature requests

### Changed
- Updated package.json with GitHub repository link

## [0.0.2] - 2025-09-25

### Added
- `listSuggestions` tool to list feature requests
- Pagination support for suggestions
- Sort options (top, new, all, moderation, rejected, muted, duplicates)

## [0.0.1] - 2025-09-25

### Added
- Initial release
- `listProjects` tool to list accessible BetaHub projects
- Token-based authentication (Personal Access Tokens, Project Auth Tokens, JWT)
- MCP server implementation using `@modelcontextprotocol/sdk`
