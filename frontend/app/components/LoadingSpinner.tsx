export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const sizeClass = size === "sm" ? "spinner-sm" : size === "lg" ? "spinner-lg" : "";
    return <div className={`spinner ${sizeClass}`}></div>;
}
