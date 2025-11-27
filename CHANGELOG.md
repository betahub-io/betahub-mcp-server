# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
