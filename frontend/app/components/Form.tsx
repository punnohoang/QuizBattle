"use client";

import { ReactNode, InputHTMLAttributes } from "react";

interface FormGroupProps {
    label?: string;
    error?: string;
    children: ReactNode;
}

export function FormGroup({ label, error, children }: FormGroupProps) {
    return (
        <div className="form-group">
            {label && <label>{label}</label>}
            {children}
            {error && <div className="form-error">{error}</div>}
        </div>
    );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function TextInput({ label, error, ...props }: TextInputProps) {
    return (
        <FormGroup label={label} error={error}>
            <input type="text" {...props} />
        </FormGroup>
    );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({ label, error, ...props }: TextareaProps) {
    return (
        <FormGroup label={label} error={error}>
            <textarea {...props} />
        </FormGroup>
    );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, error, options, ...props }: SelectProps) {
    return (
        <FormGroup label={label} error={error}>
            <select {...props}>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </FormGroup>
    );
}
