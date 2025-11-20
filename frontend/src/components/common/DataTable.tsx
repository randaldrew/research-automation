// frontend/src/components/common/DataTable.tsx
import React, { useState } from 'react';
import {
  Table,
  ScrollArea,
  Group,
  Text,
  ActionIcon,
  Select,
  Pagination,
  Card,
  Stack,
  Badge,
  Checkbox,
  Menu,
} from '@mantine/core';
import {
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconDotsVertical,
} from '@tabler/icons-react';
import { LoadingOverlay, TableRowSkeleton } from './LoadingStates';

export interface TableColumn<T = any> {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string | number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableAction<T = any> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (row: T, index: number) => void;
  color?: string;
  disabled?: (row: T) => boolean;
}

interface DataTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  error?: string;

  // Pagination
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string, order: 'asc' | 'desc') => void;

  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selected: string[]) => void;
  getRowId?: (row: T) => string;

  // Actions
  actions?: TableAction<T>[];

  // Styling
  highlightOnHover?: boolean;
  striped?: boolean;
  compact?: boolean;

  // Empty state
  emptyState?: React.ReactNode;
}

export const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error, // Now properly used for error display
  totalCount,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortOrder,
  onSort,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  getRowId = (row: T) => row.id || row.key || JSON.stringify(row),
  actions = [],
  highlightOnHover = true,
  striped = false,
  compact = false,
  emptyState
}: DataTableProps<T>) => {
  const [internalSortBy, setInternalSortBy] = useState<string | null>(sortBy || null);
  const [internalSortOrder, setInternalSortOrder] = useState<'asc' | 'desc'>(sortOrder || 'asc');

  // Handle sorting
  const handleSort = (columnKey: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';

    if (internalSortBy === columnKey) {
      newOrder = internalSortOrder === 'asc' ? 'desc' : 'asc';
    }

    setInternalSortBy(columnKey);
    setInternalSortOrder(newOrder);

    if (onSort) {
      onSort(columnKey, newOrder);
    }
  };

  // Handle selection
  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    const allIds = data.map(getRowId);
    const isAllSelected = allIds.every(id => selectedRows.includes(id));

    if (isAllSelected) {
      onSelectionChange(selectedRows.filter(id => !allIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedRows, ...allIds])]);
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange) return;

    const isSelected = selectedRows.includes(rowId);
    if (isSelected) {
      onSelectionChange(selectedRows.filter(id => id !== rowId));
    } else {
      onSelectionChange([...selectedRows, rowId]);
    }
  };

  // Render sort icon
  const renderSortIcon = (columnKey: string) => {
    if (internalSortBy !== columnKey) {
      return <IconSelector size="0.8rem" style={{ opacity: 0.5 }} />;
    }

    return internalSortOrder === 'asc' ?
      <IconChevronUp size="0.8rem" /> :
      <IconChevronDown size="0.8rem" />;
  };

  // Calculate pagination values
  const totalPages = Math.ceil((totalCount || data.length) / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount || data.length);

  // Show error state
  if (error) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text color="red" ta="center">
          Error loading data: {error}
        </Text>
      </Card>
    );
  }

  // Render table content
  const tableContent = (
    <Table
      highlightOnHover={highlightOnHover}
      striped={striped}
      verticalSpacing={compact ? 'xs' : 'sm'}
    >
      <Table.Thead>
        <Table.Tr>
          {selectable && (
            <Table.Th style={{ width: 40 }}>
              <Checkbox
                checked={data.length > 0 && data.every(row => selectedRows.includes(getRowId(row)))}
                indeterminate={
                  selectedRows.length > 0 &&
                  selectedRows.length < data.length
                }
                onChange={handleSelectAll}
                size="sm"
              />
            </Table.Th>
          )}

          {columns.map((column) => (
            <Table.Th
              key={column.key}
              style={{
                width: column.width,
                textAlign: column.align || 'left'
              }}
            >
              {column.sortable ? (
                <Group
                  gap="xs"
                  justify={column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort(column.key)}
                >
                  <Text fw={600} size="sm">
                    {column.title}
                  </Text>
                  {renderSortIcon(column.key)}
                </Group>
              ) : (
                <Group
                  gap="xs"
                  justify={column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start'}
                >
                  <Text fw={600} size="sm">
                    {column.title}
                  </Text>
                </Group>
              )}
            </Table.Th>
          ))}

          {actions.length > 0 && (
            <Table.Th style={{ width: 60, textAlign: 'center' }}>
              <Text fw={600} size="sm">
                Actions
              </Text>
            </Table.Th>
          )}
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {loading ? (
          // Loading skeleton
          Array.from({ length: pageSize }).map((_, index) => (
            <TableRowSkeleton
              key={index}
              columns={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
            />
          ))
        ) : data.length === 0 ? (
          // Empty state
          <Table.Tr>
            <Table.Td
              colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
              style={{ padding: 0 }}
            >
              {emptyState}
            </Table.Td>
          </Table.Tr>
        ) : (
          // Data rows
          data.map((row, index) => {
            const rowId = getRowId(row);
            const isSelected = selectedRows.includes(rowId);

            return (
              <Table.Tr
                key={rowId}
                style={{
                  backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined
                }}
              >
                {selectable && (
                  <Table.Td>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleSelectRow(rowId)}
                      size="sm"
                    />
                  </Table.Td>
                )}

                {columns.map((column) => (
                  <Table.Td
                    key={column.key}
                    style={{ textAlign: column.align || 'left' }}
                  >
                    {column.render
                      ? column.render(row[column.key], row, index)
                      : row[column.key]
                    }
                  </Table.Td>
                ))}

                {actions.length > 0 && (
                  <Table.Td style={{ textAlign: 'center' }}>
                    {actions.length === 1 ? (
                      <ActionIcon
                        variant="light"
                        size="sm"
                        onClick={() => actions[0].onClick(row, index)}
                        disabled={actions[0].disabled?.(row)}
                        color={actions[0].color}
                      >
                        {actions[0].icon}
                      </ActionIcon>
                    ) : (
                      <Menu shadow="md" width={180}>
                        <Menu.Target>
                          <ActionIcon variant="light" size="sm">
                            <IconDotsVertical size="1rem" />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          {actions.map((action) => (
                            <Menu.Item
                              key={action.key}
                              leftSection={action.icon}
                              onClick={() => action.onClick(row, index)}
                              disabled={action.disabled?.(row)}
                              color={action.color}
                            >
                              {action.label}
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })
        )}
      </Table.Tbody>
    </Table>
  );

  return (
    <Card shadow="sm" padding={0} radius="md" withBorder>
      <Stack gap={0}>
        <ScrollArea>
          <div style={{ position: 'relative' }}>
            {tableContent}
            <LoadingOverlay visible={loading} />
          </div>
        </ScrollArea>

        {/* Pagination and controls */}
        {(totalCount || data.length > 0) && (
          <Card.Section withBorder inheritPadding py="sm">
            <Group justify="space-between">
              <Group gap="md">
                {totalCount && (
                  <Text size="sm" c="dimmed">
                    Showing {startItem}-{endItem} of {totalCount} results
                  </Text>
                )}

                {selectedRows.length > 0 && (
                  <Badge variant="light" color="blue">
                    {selectedRows.length} selected
                  </Badge>
                )}
              </Group>

              <Group gap="md">
                {onPageSizeChange && (
                  <Group gap="xs">
                    <Text size="sm">Show</Text>
                    <Select
                      data={['10', '25', '50', '100']}
                      value={pageSize.toString()}
                      onChange={(value) => value && onPageSizeChange(parseInt(value))}
                      size="xs"
                      w={70}
                    />
                    <Text size="sm">per page</Text>
                  </Group>
                )}

                {totalCount && totalPages > 1 && (
                  <Pagination
                    value={currentPage}
                    onChange={onPageChange}
                    total={totalPages}
                    size="sm"
                  />
                )}
              </Group>
            </Group>
          </Card.Section>
        )}
      </Stack>
    </Card>
  );
};