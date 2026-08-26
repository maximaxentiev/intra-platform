import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Centre, CurrentUser, Staff } from "@/lib/db";
import type { ActivityLogActorType, ActivityLogCategory } from "@/lib/reports-types";

const CATEGORY_OPTIONS: { value: "all" | ActivityLogCategory; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "shifts", label: "Shifts" },
  { value: "staff", label: "Staff" },
  { value: "documents", label: "Documents" },
  { value: "communications", label: "Communications" },
  { value: "centres", label: "Centres" },
  { value: "users", label: "Users" },
  { value: "system", label: "System" },
];

const ACTOR_OPTIONS: { value: "all" | ActivityLogActorType; label: string }[] = [
  { value: "all", label: "All actors" },
  { value: "ops_user", label: "Ops user" },
  { value: "staff", label: "Staff" },
  { value: "system", label: "System" },
  { value: "unknown", label: "Unknown" },
];

type ActivityLogFiltersProps = {
  dateFrom: string;
  dateTo: string;
  category: string;
  actorType: string;
  opsUserId: string;
  staffId: string;
  centreId: string;
  staff: Staff[];
  centres: Centre[];
  opsUsers: CurrentUser[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onActorTypeChange: (value: string) => void;
  onOpsUserChange: (value: string) => void;
  onStaffChange: (value: string) => void;
  onCentreChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export function ActivityLogFilters({
  dateFrom,
  dateTo,
  category,
  actorType,
  opsUserId,
  staffId,
  centreId,
  staff,
  centres,
  opsUsers,
  onDateFromChange,
  onDateToChange,
  onCategoryChange,
  onActorTypeChange,
  onOpsUserChange,
  onStaffChange,
  onCentreChange,
  onApply,
  onReset,
}: ActivityLogFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="activity-date-from" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="activity-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-date-to" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="activity-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-category" className="text-xs font-medium text-muted-foreground">
            Category
          </Label>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger id="activity-category" className="h-10">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-actor" className="text-xs font-medium text-muted-foreground">
            Actor type
          </Label>
          <Select value={actorType} onValueChange={onActorTypeChange}>
            <SelectTrigger id="activity-actor" className="h-10">
              <SelectValue placeholder="All actors" />
            </SelectTrigger>
            <SelectContent>
              {ACTOR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {actorType === "ops_user" ? (
          <div className="space-y-1.5">
            <Label
              htmlFor="activity-ops-user"
              className="text-xs font-medium text-muted-foreground"
            >
              Ops user
            </Label>
            <Select value={opsUserId} onValueChange={onOpsUserChange}>
              <SelectTrigger id="activity-ops-user" className="h-10">
                <SelectValue placeholder="All ops users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ops users</SelectItem>
                {opsUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="activity-staff" className="text-xs font-medium text-muted-foreground">
            Staff
          </Label>
          <Select value={staffId} onValueChange={onStaffChange}>
            <SelectTrigger id="activity-staff" className="h-10">
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-centre" className="text-xs font-medium text-muted-foreground">
            Centre
          </Label>
          <Select value={centreId} onValueChange={onCentreChange}>
            <SelectTrigger id="activity-centre" className="h-10">
              <SelectValue placeholder="All centres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All centres</SelectItem>
              {centres.map((centre) => (
                <SelectItem key={centre.id} value={centre.id}>
                  {centre.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
        <Button variant="ghost" size="sm" type="button" onClick={onReset}>
          Reset
        </Button>
        <Button size="sm" type="button" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
