import type { OrderFilters } from "../../types/admin";

type FilterOption = {
  value: string;
  label: string;
};

type AdminOrderFiltersProps = {
  filters: OrderFilters;
  fulfilmentStatusOptions: FilterOption[];
  paymentStatusOptions: FilterOption[];
  fulfilmentMethodOptions: FilterOption[];
  onFiltersChange: (filters: OrderFilters) => void;
  onClearFilters: () => void;
};

function AdminOrderFilters({
  filters,
  fulfilmentStatusOptions,
  paymentStatusOptions,
  fulfilmentMethodOptions,
  onFiltersChange,
  onClearFilters,
}: AdminOrderFiltersProps) {
  return (
    <section className="admin-order-filters" aria-label="Order filters">
      <label>
        <span>Search orders</span>
        <input
          type="search"
          value={filters.search}
          placeholder="Order ID, name or email"
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              search: event.target.value,
            })
          }
        />
      </label>

      <label>
        <span>Fulfilment status</span>
        <select
          value={filters.fulfilmentStatus}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              fulfilmentStatus: event.target.value,
            })
          }
        >
          <option value="all">All statuses</option>
          {fulfilmentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Payment status</span>
        <select
          value={filters.paymentStatus}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              paymentStatus: event.target.value,
            })
          }
        >
          <option value="all">All payments</option>
          {paymentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Delivery method</span>
        <select
          value={filters.fulfilmentMethod}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              fulfilmentMethod: event.target.value,
            })
          }
        >
          <option value="all">All methods</option>
          {fulfilmentMethodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Sort</span>
        <select
          value={filters.sortOrder}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              sortOrder: event.target.value as OrderFilters["sortOrder"],
            })
          }
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="total-desc">Total high to low</option>
          <option value="total-asc">Total low to high</option>
        </select>
      </label>

      <button
        type="button"
        className="secondary-button admin-order-clear-filters"
        onClick={onClearFilters}
      >
        Clear filters
      </button>
    </section>
  );
}

export default AdminOrderFilters;
