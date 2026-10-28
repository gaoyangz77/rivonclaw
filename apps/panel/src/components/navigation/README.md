# Loaded list navigation

`LoadedListBackToTop` mounts inside the list's vertical scroll region. Set
`enabled` only after a successful second-page append, independently of whether
more pages remain. Reset it with the filter/query scope. It appears after 200px
of vertical scrolling, scrolls that region to zero, preserves horizontal scroll,
and honors reduced motion. It does not alter list data or pagination.

The control portals into its actual scroll host, staying inside its page/modal
DOM tree so hidden workspace tabs hide it and modal focus trapping includes it.
A zero-height sticky rail inside modals avoids transformed/clipping ancestors;
page controls use a fixed position above the tutorial bubble. Auto-overflow
wrappers without actual vertical overflow are skipped.

Append-list inventory (2026-10-28):

| Page / entry                       | Lists                                              | Enable source                                            |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Manual Affiliate workbench         | Samples; messages                                  | Each pagination.pageCount > 1                            |
| Agent workbench                    | Pending proposals                                  | proposalPages.pageCount > 1, pending tab only            |
| Affiliate campaigns (detail modal) | Search plans; Creator pipeline                     | Active pane's cursor buffer.loadedMore                   |
| Affiliate analytics (Explore tab)  | Query results                                      | Successful append; reset on a new query                  |
| Account                            | Members                                            | Expanded visible member limit, with > 1 batch of matches |
| Cron jobs (history modal)          | Run history                                        | Successful nonzero-offset page                           |
| Shared Creator detail modal        | Proposal history; samples; platform collaborations | Active tab's query.pageCount > 1                         |

Six page entries contain eight append lists, plus three in the shared Creator
modal. Creator lists and the all-Agent-work table use replacement pagination.
Customer-service experiments append selector options, not a scrolling page list.
Chat/conversation/activity history prepends older records; those retain their
existing timeline navigation rather than adopting this downward-list control.
