// frontend/src/components/common/SearchInput.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TextInput,
  ActionIcon,
  Group,
  Menu,
  Badge,
  Kbd,
  Text
} from '@mantine/core';
import {
  IconSearch,
  IconX,
  IconFilter,
  IconCalendar,
  IconTag,
  IconFileText,
  IconLink
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

export interface SearchFilters {
  dateRange?: 'today' | 'week' | 'month' | 'year' | 'all';
  contentType?: 'summaries' | 'links' | 'all';
  tags?: string[];
  source?: string;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
  filters?: SearchFilters;
  placeholder?: string;
  showFilters?: boolean;
  debounceMs?: number;
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onFiltersChange,
  filters = {},
  placeholder = 'Search...',
  showFilters = true,
  debounceMs = 300,
  size = 'md',
  width = '100%'
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [debouncedValue] = useDebouncedValue(internalValue, debounceMs);

  // Sync debounced value with parent
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  // Sync external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  const updateFilter = useCallback((key: keyof SearchFilters, filterValue: any) => {
    if (onFiltersChange) {
      const newFilters = { ...filters, [key]: filterValue };
      onFiltersChange(newFilters);
    }
  }, [filters, onFiltersChange]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.dateRange && filters.dateRange !== 'all') count++;
    if (filters.contentType && filters.contentType !== 'all') count++;
    if (filters.tags && filters.tags.length > 0) count++;
    if (filters.source) count++;
    return count;
  };

  const rightSection = (
    <Group gap="xs">
      {internalValue && (
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={handleClear}
          title="Clear search"
        >
          <IconX size="1rem" />
        </ActionIcon>
      )}

      {showFilters && (
        <Menu shadow="md" width={300} position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant={getActiveFiltersCount() > 0 ? 'filled' : 'subtle'}
              size="sm"
              title="Search filters"
            >
              <IconFilter size="1rem" />
              {getActiveFiltersCount() > 0 && (
                <Badge
                  size="xs"
                  variant="filled"
                  color="blue"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 'auto',
                    height: 16,
                    padding: '0 4px',
                    fontSize: '10px'
                  }}
                >
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Search Filters</Menu.Label>

            <Menu.Item
              leftSection={<IconCalendar size="1rem" />}
              closeMenuOnClick={false}
            >
              <Text size="sm" fw={500} mb="xs">Date Range</Text>
              <Group gap="xs">
                {['all', 'today', 'week', 'month', 'year'].map((range) => (
                  <Badge
                    key={range}
                    variant={filters.dateRange === range ? 'filled' : 'light'}
                    size="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => updateFilter('dateRange', range)}
                  >
                    {range === 'all' ? 'All time' : `This ${range}`}
                  </Badge>
                ))}
              </Group>
            </Menu.Item>

            <Menu.Divider />

            <Menu.Item
              leftSection={<IconFileText size="1rem" />}
              closeMenuOnClick={false}
            >
              <Text size="sm" fw={500} mb="xs">Content Type</Text>
              <Group gap="xs">
                {[
                  { key: 'all', label: 'All', icon: IconFileText },
                  { key: 'summaries', label: 'Summaries', icon: IconFileText },
                  { key: 'links', label: 'Links', icon: IconLink }
                ].map(({ key, label, icon: Icon }) => (
                  <Badge
                    key={key}
                    variant={filters.contentType === key ? 'filled' : 'light'}
                    size="sm"
                    leftSection={<Icon size="0.8rem" />}
                    style={{ cursor: 'pointer' }}
                    onClick={() => updateFilter('contentType', key)}
                  >
                    {label}
                  </Badge>
                ))}
              </Group>
            </Menu.Item>

            {getActiveFiltersCount() > 0 && (
              <>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconX size="1rem" />}
                  color="red"
                  onClick={() => {
                    if (onFiltersChange) {
                      onFiltersChange({
                        dateRange: 'all',
                        contentType: 'all',
                        tags: [],
                        source: undefined
                      });
                    }
                  }}
                >
                  Clear all filters
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );

  return (
    <div style={{ width }}>
      <TextInput
        placeholder={placeholder}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        leftSection={<IconSearch size="1rem" />}
        rightSection={rightSection}
        size={size}
        rightSectionWidth={showFilters ? (internalValue ? 80 : 50) : (internalValue ? 40 : 0)}
      />

      {/* Search hints */}
      {internalValue.length === 0 && (
        <Group gap="xs" mt="xs">
          <Text size="xs" c="dimmed">
            Tip: Use <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> to focus search
          </Text>
        </Group>
      )}

      {/* Active filters display */}
      {getActiveFiltersCount() > 0 && (
        <Group gap="xs" mt="xs">
          {filters.dateRange && filters.dateRange !== 'all' && (
            <Badge
              size="sm"
              variant="light"
              leftSection={<IconCalendar size="0.8rem" />}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  onClick={() => updateFilter('dateRange', 'all')}
                >
                  <IconX size="0.6rem" />
                </ActionIcon>
              }
            >
              {filters.dateRange === 'today' ? 'Today' : `This ${filters.dateRange}`}
            </Badge>
          )}

          {filters.contentType && filters.contentType !== 'all' && (
            <Badge
              size="sm"
              variant="light"
              leftSection={filters.contentType === 'summaries' ?
                <IconFileText size="0.8rem" /> :
                <IconLink size="0.8rem" />
              }
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  onClick={() => updateFilter('contentType', 'all')}
                >
                  <IconX size="0.6rem" />
                </ActionIcon>
              }
            >
              {filters.contentType === 'summaries' ? 'Summaries' : 'Links'}
            </Badge>
          )}

          {filters.source && (
            <Badge
              size="sm"
              variant="light"
              leftSection={<IconTag size="0.8rem" />}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  onClick={() => updateFilter('source', undefined)}
                >
                  <IconX size="0.6rem" />
                </ActionIcon>
              }
            >
              Source: {filters.source}
            </Badge>
          )}

          {filters.tags && filters.tags.length > 0 && (
            <Badge
              size="sm"
              variant="light"
              leftSection={<IconTag size="0.8rem" />}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  onClick={() => updateFilter('tags', [])}
                >
                  <IconX size="0.6rem" />
                </ActionIcon>
              }
            >
              {filters.tags.length} tag{filters.tags.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </Group>
      )}
    </div>
  );
};