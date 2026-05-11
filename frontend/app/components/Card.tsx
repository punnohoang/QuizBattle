"use client";

import { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export function Card({ children, className, style }: CardProps) {
    return (
        <div className={`card ${className || ""}`} style={style}>
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
    return <div className={`card-header ${className || ""}`}>{children}</div>;
}

interface CardFooterProps {
    children: ReactNode;
    className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
    return <div className={`card-footer ${className || ""}`}>{children}</div>;
}
