import type { AdminSection } from "../../types/admin";

type AdminSectionTabsProps = {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
};

const sections: { id: AdminSection; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
];

function AdminSectionTabs({
  activeSection,
  onSectionChange,
}: AdminSectionTabsProps) {
  return (
    <div className="admin-section-tabs" aria-label="Admin sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={
            activeSection === section.id
              ? "admin-section-tab admin-section-tab-active"
              : "admin-section-tab"
          }
          aria-pressed={activeSection === section.id}
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

export default AdminSectionTabs;
