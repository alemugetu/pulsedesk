/**
 * Public website content for PulseDesk.
 * 
 * Reusable marketing copy and content for the public website.
 */

/**
 * Hero content
 */
export const HERO_CONTENT = {
  title: 'Operations Management, Simplified',
  subtitle: 'PulseDesk helps teams manage incidents, track SLAs, and coordinate operations—all in one platform.',
  description: 'Built for operations teams who need clear visibility, structured workflows, and reliable incident management.',
  primaryCta: {
    label: 'Get Started',
    path: '/register',
  },
  secondaryCta: {
    label: 'Explore Features',
    path: '/features',
  },
};

/**
 * Features section content
 */
export const FEATURES_CONTENT = {
  title: 'Everything You Need to Manage Operations',
  subtitle: 'Comprehensive capabilities designed for modern operations teams.',
  features: [
    {
      title: 'Incident Management',
      description: 'Track, assign, and resolve incidents with structured workflows and clear accountability.',
    },
    {
      title: 'SLA Management',
      description: 'Define SLA policies, track response and resolution times, and get breach awareness.',
    },
    {
      title: 'Escalation',
      description: 'Automate escalation paths to ensure critical issues reach the right people.',
    },
    {
      title: 'Real-Time Operations',
      description: 'Stay informed with live operational updates and WebSocket-powered notifications.',
    },
    {
      title: 'Notifications',
      description: 'Keep teams informed with timely alerts across multiple channels.',
    },
    {
      title: 'Role-Based Access Control',
      description: 'Control who can see and do what with granular permissions and roles.',
    },
    {
      title: 'Multi-Tenant Organizations',
      description: 'Support multiple organizations with complete tenant isolation.',
    },
    {
      title: 'Reporting',
      description: 'Gain insights with operational reports and analytics.',
    },
    {
      title: 'Audit History',
      description: 'Track every action with comprehensive audit logs.',
    },
  ],
};

/**
 * Operations section content
 */
export const OPERATIONS_CONTENT = {
  title: 'Built for Operations Teams',
  subtitle: 'Give your team the tools to monitor, manage, and coordinate operations effectively.',
  points: [
    {
      title: 'Monitor Incidents',
      description: 'Get a clear view of all operational incidents in one place.',
    },
    {
      title: 'Assign Responsibility',
      description: 'Clearly assign ownership so nothing falls through the cracks.',
    },
    {
      title: 'Track Operational State',
      description: 'Know the status of every incident at a glance.',
    },
    {
      title: 'Manage Workflows',
      description: 'Structure your incident management process with defined workflows.',
    },
    {
      title: 'Coordinate Responses',
      description: 'Bring teams together to resolve incidents efficiently.',
    },
  ],
};

/**
 * SLA section content
 */
export const SLA_CONTENT = {
  title: 'SLA Management That Works',
  subtitle: 'Ensure service levels are met with clear policies and tracking.',
  points: [
    {
      title: 'SLA Policies',
      description: 'Define clear service level agreements for different incident types.',
    },
    {
      title: 'Response Tracking',
      description: 'Track first response times against your SLA commitments.',
    },
    {
      title: 'Resolution Tracking',
      description: 'Monitor resolution times to ensure timely incident closure.',
    },
    {
      title: 'Breach Awareness',
      description: 'Get alerted when SLAs are at risk or breached.',
    },
    {
      title: 'Escalation Integration',
      description: 'Automatically escalate incidents approaching SLA breaches.',
    },
  ],
};

/**
 * Real-time section content
 */
export const REALTIME_CONTENT = {
  title: 'Real-Time Operational Awareness',
  subtitle: 'Stay connected to what\'s happening across your operations.',
  points: [
    {
      title: 'Live Updates',
      description: 'See incident changes as they happen, not after the fact.',
    },
    {
      title: 'WebSocket-Powered',
      description: 'Built on modern WebSocket technology for instant updates.',
    },
    {
      title: 'Operational Awareness',
      description: 'Keep your entire team informed in real time.',
    },
  ],
};

/**
 * Security section content
 */
export const SECURITY_CONTENT = {
  title: 'Secure by Design',
  subtitle: 'Built with security and data isolation at its core.',
  points: [
    {
      title: 'Multi-Tenancy',
      description: 'Complete tenant isolation ensures your data stays yours.',
    },
    {
      title: 'Tenant Isolation',
      description: 'Organizations operate in completely separate environments.',
    },
    {
      title: 'Role-Based Access',
      description: 'Granular permissions control who can access what.',
    },
    {
      title: 'Controlled Access',
      description: 'Ensure users only see what they\'re authorized to access.',
    },
  ],
};

/**
 * CTA section content
 */
export const CTA_CONTENT = {
  title: 'Ready to Streamline Your Operations?',
  subtitle: 'Join teams using PulseDesk to manage incidents and operations more effectively.',
  primaryCta: {
    label: 'Get Started',
    path: '/register',
  },
  secondaryCta: {
    label: 'Sign In',
    path: '/login',
  },
};

/**
 * About page content
 */
export const ABOUT_CONTENT = {
  title: 'About PulseDesk',
  sections: [
    {
      heading: 'Our Purpose',
      content: 'PulseDesk was built to solve a common problem: operations teams need better tools to manage incidents, track service levels, and coordinate responses. We created a platform that brings clarity to operational chaos.',
    },
    {
      heading: 'The Problem We Solve',
      content: 'Operations teams often struggle with scattered tools, unclear ownership, and missed SLAs. Incidents get lost in emails, chat messages, and spreadsheets. Response times suffer, and accountability becomes unclear.',
    },
    {
      heading: 'Our Approach',
      content: 'We believe operations management should be straightforward. PulseDesk provides structured incident management, clear SLA tracking, and real-time visibility—all in one platform designed for operations teams.',
    },
    {
      heading: 'Platform Philosophy',
      content: 'PulseDesk is built on principles of clarity, accountability, and reliability. We focus on the core capabilities operations teams need, without unnecessary complexity.',
    },
  ],
};

/**
 * Contact page content
 */
export const CONTACT_CONTENT = {
  title: 'Contact Us',
  subtitle: 'Have questions about PulseDesk? We\'re here to help.',
  form: {
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    submit: 'Send Message',
    submitting: 'Sending...',
    success: 'Thank you for your message. We\'ll get back to you soon.',
    error: 'Something went wrong. Please try again later.',
  },
  info: {
    title: 'Get in Touch',
    description: 'Fill out the form and we\'ll respond as soon as possible.',
  },
};

/**
 * Privacy page content
 */
export const PRIVACY_CONTENT = {
  title: 'Privacy Policy',
  lastUpdated: '2024',
  notice: 'This is a draft privacy policy. Please have legal counsel review before production use.',
  sections: [
    {
      heading: 'Information Collection',
      content: 'We collect information you provide directly, such as when you create an account, submit a form, or contact us. This may include your name, email address, and organization information.',
    },
    {
      heading: 'Use of Information',
      content: 'We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to protect our users.',
    },
    {
      heading: 'Data Protection',
      content: 'We implement appropriate security measures to protect your data. This includes encryption, access controls, and secure infrastructure.',
    },
    {
      heading: 'Cookies and Local Storage',
      content: 'We use local storage to save your preferences, such as theme settings. We do not use tracking cookies.',
    },
    {
      heading: 'Third-Party Services',
      content: 'We may use third-party services for analytics and infrastructure. These services have their own privacy policies.',
    },
    {
      heading: 'Your Rights',
      content: 'You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.',
    },
    {
      heading: 'Contact',
      content: 'If you have questions about this privacy policy, please contact us.',
    },
  ],
};

/**
 * Terms page content
 */
export const TERMS_CONTENT = {
  title: 'Terms of Service',
  lastUpdated: '2024',
  notice: 'This is a draft terms of service. Please have legal counsel review before production use.',
  sections: [
    {
      heading: 'Acceptance',
      content: 'By accessing or using PulseDesk, you agree to be bound by these terms. If you do not agree, do not use the service.',
    },
    {
      heading: 'Service Description',
      content: 'PulseDesk is an operations management platform providing incident management, SLA tracking, and related capabilities.',
    },
    {
      heading: 'Accounts',
      content: 'You are responsible for maintaining the security of your account and password. You must notify us of any unauthorized access.',
    },
    {
      heading: 'Acceptable Use',
      content: 'You agree to use PulseDesk only for lawful purposes and in accordance with these terms. You must not attempt to gain unauthorized access to the service.',
    },
    {
      heading: 'User Responsibilities',
      content: 'You are responsible for your use of the service and for any data you upload or transmit.',
    },
    {
      heading: 'Data',
      content: 'You retain ownership of your data. By using the service, you grant us permission to process your data as necessary to provide the service.',
    },
    {
      heading: 'Service Availability',
      content: 'We strive to maintain service availability but do not guarantee uninterrupted access. We may perform maintenance that temporarily disrupts service.',
    },
    {
      heading: 'Intellectual Property',
      content: 'PulseDesk and its original content, features, and functionality are owned by PulseDesk and are protected by applicable laws.',
    },
    {
      heading: 'Termination',
      content: 'We may terminate or suspend your access to the service immediately, without prior notice, for conduct that we believe violates these terms.',
    },
    {
      heading: 'Limitation of Liability',
      content: 'PulseDesk shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.',
    },
    {
      heading: 'Changes',
      content: 'We reserve the right to modify these terms at any time. We will notify users of material changes.',
    },
    {
      heading: 'Contact',
      content: 'If you have questions about these terms, please contact us.',
    },
  ],
};
