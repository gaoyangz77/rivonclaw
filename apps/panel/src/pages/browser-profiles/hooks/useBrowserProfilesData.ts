import { useState, useEffect, useCallback, useRef } from "react";
import type { GQL } from "@rivonclaw/core";
import { DEFAULTS } from "@rivonclaw/core";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";

const PAGE_SIZE_OPTIONS = DEFAULTS.pagination.browserProfilesOptions;

export function useBrowserProfilesData() {
  const entityStore = useEntityStore();
  const [profiles, setProfiles] = useState<GQL.BrowserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "ARCHIVED">("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Reset page when filter or page size changes
  useEffect(() => {
    setCurrentPage(0);
  }, [statusFilter, pageSize]);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (statusFilter !== "all") filter.status = [statusFilter];
      if (searchQuery) filter.query = searchQuery;

      const data = await entityStore.fetchBrowserProfiles(
        Object.keys(filter).length > 0 ? filter : undefined,
        { offset: currentPage * pageSize, limit: pageSize },
      );
      setProfiles(data.items);
      setTotalProfiles(data.total);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    profiles,
    loading,
    loadError,
    searchInput,
    setSearchInput,
    searchQuery,
    statusFilter,
    setStatusFilter,
    currentPage,
    setCurrentPage,
    totalProfiles,
    pageSize,
    setPageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    loadProfiles,
  };
}
