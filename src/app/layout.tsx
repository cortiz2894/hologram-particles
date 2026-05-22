import type { Metadata } from "next";
import { bebasNeue, barlowCondensed, ibmPlexMono } from "@/components/shared/fonts";
import "./globals.css";
import Footer from "@/components/overlay/components/Footer/Footer";


export const metadata: Metadata = {
  title: "3D Playground",
  description: "Unity-style 3D playground built with R3F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bebasNeue.variable} ${barlowCondensed.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <Footer />
      </body>
    </html>
  );
}
