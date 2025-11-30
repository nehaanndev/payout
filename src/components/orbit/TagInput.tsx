"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    suggestions: string[];
    onValueChange: (value: string) => void;
}

export function TagInput({
    suggestions,
    value,
    onValueChange,
    className,
    ...props
}: TagInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse the current tag being typed (word at cursor)
    const currentTag = useMemo(() => {
        if (!value) return "";
        const textBeforeCursor = String(value).slice(0, cursorPosition);
        const words = textBeforeCursor.split(/[, ]+/);
        return words[words.length - 1] || "";
    }, [value, cursorPosition]);

    // Filter suggestions
    const filteredSuggestions = useMemo(() => {
        if (!currentTag || currentTag.length < 1) return [];
        const lowerTag = currentTag.toLowerCase();
        return suggestions
            .filter((s) => s.toLowerCase().startsWith(lowerTag) && s.toLowerCase() !== lowerTag)
            .slice(0, 5); // Limit to 5 suggestions
    }, [suggestions, currentTag]);

    useEffect(() => {
        setIsOpen(filteredSuggestions.length > 0);
    }, [filteredSuggestions]);

    // Handle outside click to close suggestions
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onValueChange(newValue);
        setCursorPosition(e.target.selectionStart || 0);
    };

    const handleSelectSuggestion = (suggestion: string) => {
        if (!value) return;

        const textBeforeCursor = String(value).slice(0, cursorPosition);
        const textAfterCursor = String(value).slice(cursorPosition);


        const words = textBeforeCursor.split(/([, ]+)/);
        // Replace the last word (which is the partial tag) with the suggestion
        words[words.length - 1] = suggestion;

        const newValue = words.join("") + textAfterCursor;

        onValueChange(newValue);
        setIsOpen(false);

        // Focus back and set cursor
        if (inputRef.current) {
            inputRef.current.focus();
            // We need to calculate new cursor position. 
            // It's roughly: prefix length + suggestion length
            // But let's just put it at the end of the inserted tag for now.
            // Or better, let the user continue typing.
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setIsOpen(false);
        }
        // We could add arrow key navigation here later
    };

    return (
        <div className="relative" ref={containerRef}>
            <Input
                ref={inputRef}
                value={value}
                onChange={handleInputChange}
                onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart || 0)}
                onKeyDown={handleKeyDown}
                className={cn("w-full", className)}
                autoComplete="off"
                {...props}
            />
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden animate-in fade-in-0 zoom-in-95">
                    <div className="p-1">
                        {filteredSuggestions.map((suggestion) => (
                            <div
                                key={suggestion}
                                className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer"
                                onClick={() => handleSelectSuggestion(suggestion)}
                            >
                                {suggestion}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
