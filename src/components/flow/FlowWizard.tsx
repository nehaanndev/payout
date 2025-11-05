"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Moon, Plus, Sun, UtensilsCrossed, Workflow } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FlowCategory, FlowSettings } from "@/types/flow";
import { generateId } from "@/lib/id";

const categoryOptions: Array<{ id: FlowCategory; label: string; emoji: string }> = [
  { id: "work", label: "Work", emoji: "💼" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
  { id: "home", label: "Home & chores", emoji: "🏡" },
  { id: "wellness", label: "Wellness", emoji: "🌿" },
  { id: "play", label: "Leisure & play", emoji: "🎈" },
  { id: "growth", label: "Growth", emoji: "📚" },
];

const stepTitles = [
  "Set your daily anchors",
  "Tune your meals",
  "Add fixed rituals",
  "Review your rhythm",
] as const;

const cloneSettings = (settings: FlowSettings): FlowSettings => ({
  ...settings,
  meals: settings.meals.map((meal) => ({ ...meal })),
  fixedEvents: settings.fixedEvents.map((event) => ({ ...event })),
});

type FlowWizardProps = {
  open: boolean;
  settings: FlowSettings;
  onClose: () => void;
  onSave: (settings: FlowSettings) => void;
};

export function FlowWizard({ open, settings, onClose, onSave }: FlowWizardProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FlowSettings>(() => cloneSettings(settings));

  useEffect(() => {
    if (open) {
      setDraft(cloneSettings(settings));
      setStep(0);
    }
  }, [open, settings]);

  const canProceed = useMemo(() => {
    if (step === 0) {
      return Boolean(draft.workStart) && Boolean(draft.workEnd);
    }
    if (step === 1) {
      return draft.meals.every((meal) => meal.time && meal.durationMinutes > 0);
    }
    if (step === 2) {
      return draft.fixedEvents.every(
        (event) =>
          Boolean(event.label.trim()) &&
          Boolean(event.startTime) &&
          event.durationMinutes > 0
      );
    }
    return true;
  }, [draft.fixedEvents, draft.meals, draft.workEnd, draft.workStart, step]);

  const handleAddMeal = () => {
    setDraft((prev) => ({
      ...prev,
      meals: [
        ...prev.meals,
        {
          id: generateId(),
          label: "Break",
          time: "15:00",
          durationMinutes: 20,
        },
      ],
    }));
  };

  const handleMealChange = (
    index: number,
    field: "label" | "time" | "durationMinutes",
    value: string
  ) => {
    setDraft((prev) => {
      const meals = prev.meals.slice();
      const target = { ...meals[index] };
      if (field === "durationMinutes") {
        target.durationMinutes = Number(value);
      } else {
        target[field] = value;
      }
      meals[index] = target;
      return { ...prev, meals };
    });
  };

  const handleRemoveMeal = (index: number) => {
    setDraft((prev) => {
      const meals = prev.meals.slice();
      meals.splice(index, 1);
      return { ...prev, meals };
    });
  };

  const handleAddFixedEvent = () => {
    setDraft((prev) => ({
      ...prev,
      fixedEvents: [
        ...prev.fixedEvents,
        {
          id: generateId(),
          label: "Kid pickup",
          category: "family",
          startTime: "15:30",
          durationMinutes: 30,
        },
      ],
    }));
  };

  const handleFixedEventChange = (
    index: number,
    field: "label" | "category" | "startTime" | "durationMinutes",
    value: string
  ) => {
    setDraft((prev) => {
      const fixedEvents = prev.fixedEvents.slice();
      const target = { ...fixedEvents[index] };
      if (field === "durationMinutes") {
        target.durationMinutes = Number(value);
      } else if (field === "category") {
        target.category = value as FlowCategory;
      } else {
        target[field] = value;
      }
      fixedEvents[index] = target;
      return { ...prev, fixedEvents };
    });
  };

  const handleRemoveFixedEvent = (index: number) => {
    setDraft((prev) => {
      const fixedEvents = prev.fixedEvents.slice();
      fixedEvents.splice(index, 1);
      return { ...prev, fixedEvents };
    });
  };

  const advance = () => {
    if (step === stepTitles.length - 1) {
      onSave({
        ...draft,
        meals: draft.meals.map((meal) => ({
          ...meal,
          durationMinutes: Math.max(5, meal.durationMinutes),
        })),
        fixedEvents: draft.fixedEvents.map((event) => ({
          ...event,
          durationMinutes: Math.max(5, event.durationMinutes),
        })),
      });
      return;
    }
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (step === 0) {
      onClose();
      return;
    }
    setStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 px-0 pb-0 pt-0 shadow-2xl shadow-emerald-200/40 sm:max-w-3xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-6 py-5 backdrop-blur">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Workflow className="h-5 w-5 text-emerald-500" />
              Flow day wizard
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Shape your default rhythm. Flow will apply these anchors whenever you start a new day.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <span>
              Step {step + 1} of {stepTitles.length}
            </span>
            <span className="text-slate-400">·</span>
            <span>{stepTitles[step]}</span>
          </div>
        </div>

        <div className="px-6 py-6">
          {step === 0 ? (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Workday cadence
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="work-start">Start work</Label>
                    <Input
                      id="work-start"
                      type="time"
                      value={draft.workStart}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, workStart: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="work-end">End work</Label>
                    <Input
                      id="work-end"
                      type="time"
                      value={draft.workEnd}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, workEnd: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>
              <Separator />
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  Rest & sleep
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sleep-start">Lights out</Label>
                    <Input
                      id="sleep-start"
                      type="time"
                      value={draft.sleepStart}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, sleepStart: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleep-end">Wake up</Label>
                    <Input
                      id="sleep-end"
                      type="time"
                      value={draft.sleepEnd}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, sleepEnd: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                  Meals & breaks
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={handleAddMeal}>
                  <Plus className="h-4 w-4" /> Add break
                </Button>
              </div>
              <div className="space-y-3">
                {draft.meals.map((meal, index) => (
                  <div
                    key={meal.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex-1 space-y-2">
                      <Label>Label</Label>
                      <Input
                        value={meal.label}
                        onChange={(event) => handleMealChange(index, "label", event.target.value)}
                      />
                    </div>
                    <div className="flex flex-1 gap-3">
                      <div className="flex-1 space-y-2">
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={meal.time}
                          onChange={(event) => handleMealChange(index, "time", event.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label>Duration (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          value={meal.durationMinutes}
                          onChange={(event) =>
                            handleMealChange(index, "durationMinutes", event.target.value)
                          }
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMeal(index)}
                      className="text-slate-500 hover:text-rose-500"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <Sun className="h-4 w-4 text-emerald-500" />
                  Fixed rituals
                </div>
                <Button variant="ghost" size="sm" className="gap-1" onClick={handleAddFixedEvent}>
                  <Plus className="h-4 w-4" /> Add event
                </Button>
              </div>
              {draft.fixedEvents.length ? (
                <div className="space-y-3">
                  {draft.fixedEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
                    >
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input
                          value={event.label}
                          onChange={(ev) =>
                            handleFixedEventChange(index, "label", ev.target.value)
                          }
                          placeholder="School pickup, swim lesson..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={event.category}
                          onValueChange={(value) =>
                            handleFixedEventChange(index, "category", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                <span className="flex items-center gap-2">
                                  <span>{option.emoji}</span>
                                  {option.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Start time</Label>
                        <Input
                          type="time"
                          value={event.startTime}
                          onChange={(ev) =>
                            handleFixedEventChange(index, "startTime", ev.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration (min)</Label>
                        <Input
                          type="number"
                          min={5}
                          value={event.durationMinutes}
                          onChange={(ev) =>
                            handleFixedEventChange(index, "durationMinutes", ev.target.value)
                          }
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFixedEvent(index)}
                          className="text-slate-500 hover:text-rose-500"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                  No fixed events yet. Add school runs, classes, or daily rituals so Flow keeps them protected.
                </p>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Summary
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
                    <p>
                      <strong>Work hours:</strong> {draft.workStart} - {draft.workEnd}
                    </p>
                    <p>
                      <strong>Sleep:</strong> {draft.sleepStart} - {draft.sleepEnd}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">Meals & breaks</p>
                    <ul className="mt-1 space-y-1">
                      {draft.meals.map((meal) => (
                        <li key={meal.id}>
                          {meal.label}: {meal.time} · {meal.durationMinutes} min
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Fixed events
                </h3>
                {draft.fixedEvents.length ? (
                  <ul className="space-y-1 text-sm text-slate-600">
                    {draft.fixedEvents.map((event) => {
                      const category = categoryOptions.find((item) => item.id === event.category);
                      return (
                        <li key={event.id} className="flex items-center gap-2">
                          <span>{category?.emoji}</span>
                          <span className="font-medium text-slate-700">{event.label}</span>
                          <span>- {event.startTime}</span>
                          <span>· {event.durationMinutes} min</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                    No fixed chores or rituals added.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <DialogFooter className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/90 px-6 py-4">
          <Button variant="ghost" onClick={goBack}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              onClick={advance}
              disabled={!canProceed}
              className="bg-emerald-500 text-white hover:bg-emerald-400"
            >
              {step === stepTitles.length - 1 ? "Save defaults" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
