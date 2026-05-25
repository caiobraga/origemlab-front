import { Link } from "wouter";

export default function SkipLink() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Pular para conteúdo principal
      </a>
      <a
        href="#navigation"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Pular para navegação
      </a>
    </>
  );
}
