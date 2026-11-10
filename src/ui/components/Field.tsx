"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * The wiring every form control needs, in one place.
 *
 * A control inside a `FormField` inherits its `id`, `aria-describedby`,
 * `aria-invalid`, `required` and `disabled` from here, so a page cannot forget
 * the wiring and ship an input a screen reader cannot name. `TextField` has
 * its own label built in (M3 floats it); `FormField` is for everything else —
 * a group of radios, a slider, a file picker.
 */

type FieldState = {
    id: string;
    describedBy?: string;
    invalid: boolean;
    disabled: boolean;
    required: boolean;
};

const FieldContext = createContext<FieldState | null>(null);

/** Controls call this to inherit the field's id, error state and description. */
export function useFieldState(): FieldState | null {
    return useContext(FieldContext);
}

export type FormFieldProps = {
    label: ReactNode;
    /** What to type, or why it is asked for. Shown under the control. */
    hint?: ReactNode;
    /** Replaces the hint when set. Say what went wrong AND what to do next. */
    error?: ReactNode;
    required?: boolean;
    disabled?: boolean;
    /** Hides the label visually. It still names the control for screen readers. */
    hideLabel?: boolean;
    /** Renders as a `<fieldset>`/`<legend>` — for a group of radios or checkboxes. */
    as?: "label" | "group";
    className?: string;
    children: ReactNode;
};

export function FormField({ label, hint, error, required = false, disabled = false, hideLabel, as = "label", className, children }: FormFieldProps) {
    const uid = useId();
    const id = `f-${uid}`;
    const msgId = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

    const caption = error ? (
        <p id={msgId} role="alert" className="px-4 text-body-sm text-error">
            {error}
        </p>
    ) : hint ? (
        <p id={msgId} className="px-4 text-body-sm text-on-surface-variant">
            {hint}
        </p>
    ) : null;

    const labelText = (
        <>
            {label}
            {required ? (
                <span aria-hidden className="text-on-surface-variant">
                    {" *"}
                </span>
            ) : null}
        </>
    );

    return (
        <FieldContext.Provider value={{ id, describedBy: msgId, invalid: Boolean(error), disabled, required }}>
            {as === "group" ? (
                <fieldset
                    aria-describedby={msgId}
                    className={cn("flex min-w-0 flex-col gap-2 border-0 p-0", className)}
                >
                    <legend className={cn("mb-1 text-title-sm text-on-surface", hideLabel && "sr-only", disabled && "opacity-[0.38]")}>
                        {labelText}
                    </legend>
                    {children}
                    {caption}
                </fieldset>
            ) : (
                <div className={cn("flex min-w-0 flex-col gap-1", className)}>
                    <label htmlFor={id} className={cn("text-title-sm text-on-surface", hideLabel && "sr-only", disabled && "opacity-[0.38]")}>
                        {labelText}
                    </label>
                    {children}
                    {caption}
                </div>
            )}
        </FieldContext.Provider>
    );
}

/**
 * Supporting text under a text field — M3 puts it at `body-sm`, 16dp in from
 * the edge, and it becomes the error message rather than sitting beside one.
 */
export function SupportingText({ id, error, children }: { id?: string; error?: boolean; children: ReactNode }) {
    return (
        <p id={id} role={error ? "alert" : undefined} className={cn("px-4 pt-1 text-body-sm", error ? "text-error" : "text-on-surface-variant")}>
            {children}
        </p>
    );
}
