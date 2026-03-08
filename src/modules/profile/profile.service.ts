import prisma from "../../config/database";

export const DEFAULT_PROFILE = {
  name: "YASH RANA",
  email: "ranayash812@gmail.com",
  phone: "+91 81309 23346",
  location: "New Delhi, India",
  website: "https://yashrana.online",
  linkedin: "https://linkedin.com/in/devop-yash-rana",
  summary:
    "Full Stack Engineer focused on building scalable backend systems and production-grade distributed applications. Experienced in microservices architecture, CI/CD automation, and cloud-native deployments using MERN and containerized infrastructure.",
  skills: {
    languages: ["JavaScript", "TypeScript", "SQL", "Rust"],
    frontend: ["React.js", "Next.js", "Tailwind CSS"],
    backend: ["Node.js", "Express.js", "REST APIs", "WebSockets"],
    databases: ["MongoDB", "PostgreSQL", "Redis"],
    devops: ["Docker", "AWS", "CI/CD", "Nginx"],
  },
  experience: [
    {
      title: "Full Stack Blockchain Developer",
      company: "QuadB Technologies",
      location: "Ludhiana, Punjab",
      startDate: "Nov 2024",
      endDate: "Present",
      bullets: [
        "Developed and deployed Rust-based smart contracts on ICP blockchain with secure transaction validation.",
        "Integrated decentralized applications with backend APIs ensuring secure data exchange.",
        "Optimized contract performance and implemented access control mechanisms for production environments.",
      ],
    },
    {
      title: "Full Stack Developer Intern",
      company: "Chainshift",
      location: "Greater Noida, Uttar Pradesh",
      startDate: "Oct 2023",
      endDate: "Apr 2024",
      bullets: [
        "Built scalable MERN stack applications with RESTful APIs and optimized database queries.",
        "Integrated third-party APIs and backend services improving system reliability and workflow automation.",
        "Implemented CI/CD pipelines using Docker and cloud deployments for production-ready releases.",
      ],
    },
  ],
  education: [
    {
      degree: "Bachelor's of Computer Application",
      institution: "Quantum University",
      startYear: "2022",
      endYear: "2025",
    },
  ],
  projects: [
    {
      name: "Trivx AI",
      role: "Founder & Full Stack Engineer",
      url: "https://trivx.in",
      description: "AI-Driven DevOps Orchestration Platform",
      bullets: [
        "Built an AI-driven DevOps orchestration platform automating CI/CD pipelines and multi-cloud deployments.",
        "Designed microservices-based architecture supporting AWS, GCP, and Azure integrations.",
        "Implemented role-based access control (RBAC), usage-based billing, and real-time observability dashboard reducing manual deployment effort by 90%.",
      ],
    },
  ],
  certifications: [
    { name: "API Security Architect" },
    { name: "Kubernetes for Developers" },
  ],
};

export async function getProfile() {
  let profile = await prisma.candidateProfile.findFirst();
  if (!profile) {
    profile = await prisma.candidateProfile.create({ data: DEFAULT_PROFILE as any });
  }
  return profile;
}

export async function updateProfile(data: any) {
  const existing = await prisma.candidateProfile.findFirst();
  if (existing) {
    return prisma.candidateProfile.update({ where: { id: existing.id }, data });
  }
  return prisma.candidateProfile.create({ data });
}
