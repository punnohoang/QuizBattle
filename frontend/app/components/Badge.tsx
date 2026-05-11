"use client";

interface BadgeProps {
    children: React.ReactNode;
    variant?: "default" | "success" | "danger" | "warning";
}

export function Badge({ children, variant = "default" }: BadgeProps) {
    let className = "badge";
    if (variant === "success") className += " badge-success";
    else if (variant === "danger") className += " badge-danger";
    else if (variant === "warning") className += " badge-warning";

    return <span className={className}>{children}</span>;
}
