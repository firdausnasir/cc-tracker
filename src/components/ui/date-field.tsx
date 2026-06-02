"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateFieldProps = {
  /** Name of the hidden input submitted with the form (yyyy-MM-dd string). */
  name: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: Date;
  /** Optional bound so a statement date can't sit after its due date, etc. */
  disabled?: React.ComponentProps<typeof Calendar>["disabled"];
};

// shadcn's canonical date picker: Popover + Calendar (react-day-picker), with the
// value mirrored into a hidden input so existing server actions keep receiving a
// plain `yyyy-MM-dd` string — no backend change needed.
export function DateField({
  name,
  id,
  required,
  placeholder = "Pick a date",
  defaultValue,
  disabled,
}: DateFieldProps) {
  const [date, setDate] = React.useState<Date | undefined>(defaultValue);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={date ? format(date, "yyyy-MM-dd") : ""}
        required={required}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              size="lg"
              className={cn(
                "w-full justify-start gap-2 font-normal",
                !date && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {date ? format(date, "d MMM yyyy") : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            disabled={disabled}
            autoFocus
            onSelect={(next) => {
              setDate(next);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
