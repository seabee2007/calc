import React from 'react';
import {
  LEGAL_MODAL_H3,
  LEGAL_MODAL_H4,
  LEGAL_MODAL_LINK,
  LEGAL_MODAL_LIST,
  LEGAL_MODAL_LIST_SPACED,
  LEGAL_MODAL_META,
  LEGAL_MODAL_ROOT,
  LEGAL_MODAL_SECTION,
} from './legalModalStyles';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className={LEGAL_MODAL_ROOT}>
      <section className={LEGAL_MODAL_SECTION}>
        <h2 className={`${LEGAL_MODAL_H3} text-xl`}>Concrete Calc Privacy Policy</h2>
        <p className={LEGAL_MODAL_META}>Last Updated: 12 June 2026</p>
        <p>
          This Privacy Policy explains how <strong>ConcreteCalc, LLC</strong> (&ldquo;Concrete Calc,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, stores, shares, and protects
          information when you access or use Concrete Calc, including our websites, web application, mobile or
          progressive web application, calculators, estimating tools, proposal tools, scheduling tools, project
          management tools, client portal features, email features, accounting and tax export tools, integrations,
          and related services (collectively, the &ldquo;Service&rdquo;).
        </p>
        <p>
          By using the Service, you agree to the collection and use of information as described in this Privacy
          Policy. If you do not agree, do not use the Service.
        </p>
        <p>
          If your legal company name, support email, or mailing address is different from the placeholders in this
          Policy, update them before publishing.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>1. Information We Collect</h3>
        <p>
          We collect information you provide directly, information generated through your use of the Service, and
          information received from third-party services that help us operate the Service.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.1 Account Information</h4>
        <p>When you create an account or sign in, we may collect:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Password or authentication credentials, handled by our authentication provider</li>
          <li>User ID</li>
          <li>Profile image, if provided</li>
          <li>Account settings</li>
          <li>Role, permission level, or team membership</li>
          <li>Login and authentication records</li>
        </ul>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.2 Business and Company Information</h4>
        <p>
          When you complete onboarding, company settings, proposals, invoices, exports, or account settings, we
          may collect:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Business name</li>
          <li>Business address</li>
          <li>Business phone number</li>
          <li>Business email address</li>
          <li>Business logo</li>
          <li>License number</li>
          <li>Company slogan</li>
          <li>Tax or accounting preferences</li>
          <li>Labor rate settings</li>
          <li>Markup, overhead, profit, tax, and pricing preferences</li>
          <li>Subscription and plan information</li>
          <li>Team and employee information</li>
        </ul>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.3 Project and Client Information</h4>
        <p>
          When you create or manage projects, proposals, client records, schedules, or field records, we may
          collect:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Project name</li>
          <li>Project address or jobsite location</li>
          <li>Project scope of work</li>
          <li>Project status and stage</li>
          <li>Client name</li>
          <li>Client company</li>
          <li>Client email address</li>
          <li>Client phone number</li>
          <li>Client address</li>
          <li>Project files and attachments</li>
          <li>RFIs, FARs, change orders, QC records, field notes, and daily report information</li>
          <li>Proposal records and proposal status</li>
          <li>Client portal or share-link information</li>
          <li>Project financial information</li>
          <li>Project schedule and activity information</li>
          <li>Team assignments and project access records</li>
        </ul>
        <p>
          You are responsible for ensuring that you have the right to provide any client, employee, subcontractor,
          supplier, or third-party information you enter into the Service.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.4 Estimating, Scheduling, and Calculation Data</h4>
        <p>
          The Service may collect and store construction-related data you enter, import, select, generate, or save,
          including:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Measurements, dimensions, quantities, units, and calculation inputs</li>
          <li>Concrete calculator data</li>
          <li>Construction activities</li>
          <li>Work elements and production-rate selections</li>
          <li>Labor rates and labor cost snapshots</li>
          <li>Man-hours, durations, crew sizes, and hours per day</li>
          <li>Material, equipment, subcontractor, and indirect cost information, if entered</li>
          <li>Estimate type, estimate settings, markup, contingency, overhead, profit, and tax settings</li>
          <li>Schedule Preview data</li>
          <li>Logic Network relationships</li>
          <li>CPM calculations</li>
          <li>Level III Gantt data</li>
          <li>Crew demand data</li>
          <li>Project charts and reporting outputs</li>
        </ul>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.5 Proposal, Email, and Communication Data</h4>
        <p>
          When you send or manage proposals, invites, project communications, or transactional emails through the
          Service, we may collect:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Recipient email addresses</li>
          <li>CC or BCC email addresses, if used</li>
          <li>Sender information</li>
          <li>Email subject</li>
          <li>Email template used</li>
          <li>Proposal link or public token</li>
          <li>Email delivery status</li>
          <li>Bounce, complaint, open, click, or delivery event information where supported</li>
          <li>Message metadata</li>
          <li>Date and time sent</li>
          <li>Related project or proposal ID</li>
        </ul>
        <p>
          We use email service providers to send transactional emails. We do not guarantee delivery, inbox
          placement, open rates, or recipient action.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.6 Payment and Subscription Information</h4>
        <p>
          If you subscribe to a paid plan, start a trial, upgrade, downgrade, cancel, or manage billing, we may
          collect or receive:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Subscription plan</li>
          <li>Billing interval</li>
          <li>Subscription status</li>
          <li>Stripe customer ID</li>
          <li>Stripe subscription ID</li>
          <li>Stripe price ID</li>
          <li>Trial dates</li>
          <li>Current billing period dates</li>
          <li>Cancellation status</li>
          <li>Payment success or failure status</li>
          <li>Invoice and billing portal status</li>
        </ul>
        <p>
          Payment card details are processed by our payment processor. We do not store full payment card numbers on
          our servers.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.7 Accounting and Tax Export Information</h4>
        <p>If you use Accounting &amp; Tax features, we may collect or process:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Tax year</li>
          <li>Accounting method preferences</li>
          <li>Business entity preferences, if entered</li>
          <li>Revenue summaries</li>
          <li>Expense categories</li>
          <li>Project profit and loss summaries</li>
          <li>Labor, material, equipment, subcontractor, and indirect cost summaries</li>
          <li>Change order summaries</li>
          <li>Proposal and payment summaries</li>
          <li>Export history</li>
          <li>CPA workbook, CSV, PDF, ZIP, QuickBooks-related, or TurboTax helper export settings</li>
        </ul>
        <p>
          Accounting and tax exports are user-controlled business record tools. They are not tax, legal,
          accounting, or financial advice.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.8 Location and Weather Information</h4>
        <p>
          The Service may request location information to provide weather, placement, curing, or project risk
          features.
        </p>
        <p>We may collect:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Approximate location</li>
          <li>Precise location, if you grant permission</li>
          <li>Jobsite address</li>
          <li>Latitude and longitude</li>
          <li>Weather forecast or historical weather data related to your project</li>
        </ul>
        <p>
          You may disable location permissions through your device or browser. Some weather or project condition
          features may not work without location data.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.9 Device, Usage, and Diagnostic Information</h4>
        <p>We may automatically collect information about how you access and use the Service, including:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>IP address</li>
          <li>Browser type</li>
          <li>Device type</li>
          <li>Operating system</li>
          <li>App version</li>
          <li>Pages or features used</li>
          <li>Date and time of access</li>
          <li>Referring pages</li>
          <li>Error logs</li>
          <li>Crash reports</li>
          <li>Performance data</li>
          <li>Session data</li>
          <li>Security logs</li>
          <li>Feature usage events</li>
        </ul>
        <p>This information helps us operate, secure, improve, and troubleshoot the Service.</p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.10 Cookies and Similar Technologies</h4>
        <p>We may use cookies, local storage, session storage, pixels, SDKs, or similar technologies to:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Keep you signed in</li>
          <li>Remember preferences</li>
          <li>Support security features</li>
          <li>Improve performance</li>
          <li>Understand usage</li>
          <li>Support analytics</li>
          <li>Support marketing or attribution, if enabled</li>
        </ul>
        <p>
          You can manage cookies through your browser settings. Disabling cookies may affect Service
          functionality.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>1.11 Information From Third Parties</h4>
        <p>We may receive information from third-party services, including:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Authentication providers</li>
          <li>Payment processors</li>
          <li>Email providers</li>
          <li>Hosting providers</li>
          <li>Database providers</li>
          <li>Storage providers</li>
          <li>Analytics providers</li>
          <li>Accounting or QuickBooks-related integrations</li>
          <li>Client portal or share-link systems</li>
          <li>App stores or browser platforms</li>
        </ul>
        <p>
          The information we receive depends on your settings, integrations, permissions, and use of those
          services.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>2. How We Use Information</h3>
        <p>We use information to provide, operate, secure, support, and improve the Service.</p>
        <p>We may use information to:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Create and manage accounts</li>
          <li>Authenticate users</li>
          <li>Provide project dashboards</li>
          <li>Save project and client records</li>
          <li>Generate estimates and calculations</li>
          <li>Generate proposals and documents</li>
          <li>Send proposal emails, invites, notifications, and service messages</li>
          <li>Provide client portal and share-link functionality</li>
          <li>Generate schedules, CPM outputs, Gantt charts, crew demand, and charts</li>
          <li>
            Generate accounting, tax, CPA, CSV, PDF, Excel, ZIP, QuickBooks-related, and tax helper exports
          </li>
          <li>Process subscriptions, trials, billing, upgrades, cancellations, and payment status</li>
          <li>Provide customer support</li>
          <li>Troubleshoot errors</li>
          <li>Monitor security and prevent abuse</li>
          <li>Enforce terms, policies, and plan limits</li>
          <li>Improve features, performance, design, and reliability</li>
          <li>Analyze usage and product adoption</li>
          <li>Comply with legal obligations</li>
          <li>Protect our rights, users, and the public</li>
        </ul>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>3. Legal Bases for Processing</h3>
        <p>
          Where required by applicable law, such as GDPR, we process personal information based on one or more
          legal bases, including:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Performance of a contract, such as providing the Service you request</li>
          <li>Legitimate interests, such as securing and improving the Service</li>
          <li>Consent, such as location permissions or optional communications</li>
          <li>Legal obligations, such as tax, accounting, fraud prevention, or regulatory requirements</li>
          <li>Protection of rights, security, and legal claims</li>
        </ul>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>4. How We Share Information</h3>
        <p>
          We do not sell personal information in the traditional sense. We do not rent client lists, project
          records, or proposal data to third parties.
        </p>
        <p>We may share information in the following ways.</p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.1 Service Providers</h4>
        <p>We share information with vendors that help us operate the Service, such as:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Database and authentication providers</li>
          <li>Hosting providers</li>
          <li>Storage providers</li>
          <li>Payment processors</li>
          <li>Email providers</li>
          <li>Analytics and diagnostics providers</li>
          <li>Customer support tools</li>
          <li>Accounting or integration providers</li>
          <li>Security and infrastructure providers</li>
        </ul>
        <p>
          These providers may process information only as needed to provide services to us, subject to their own
          terms, privacy policies, and security obligations.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.2 Payment Processors</h4>
        <p>
          Payment information is processed by third-party payment processors, such as Stripe. We receive payment
          and subscription status information but do not store full card numbers.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.3 Email Providers</h4>
        <p>
          Transactional emails may be sent through third-party email providers. Email metadata, delivery status,
          bounce status, complaint status, open status, and click status may be processed where supported.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.4 Integrations</h4>
        <p>
          If you connect third-party integrations, such as accounting platforms, export systems, or other tools,
          we may share information according to your authorization and the integration&rsquo;s functionality.
        </p>
        <p>
          You are responsible for reviewing the third-party provider&rsquo;s terms and privacy policy before
          connecting an integration.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.5 Team Members and Authorized Users</h4>
        <p>
          If you invite employees, clients, subcontractors, team members, or other users, information may be
          visible to those users according to their role, permission level, project access, or client portal
          access.
        </p>
        <p>You are responsible for managing invited users and removing access when appropriate.</p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.6 Client Portal and Shared Links</h4>
        <p>
          If you create public links, proposal links, client portal access, or shared project views, people with
          access to those links or invitations may view the information made available through them.
        </p>
        <p>You are responsible for deciding what to share and with whom.</p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.7 Legal, Safety, and Compliance</h4>
        <p>We may disclose information if we believe it is necessary to:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Comply with law, subpoena, court order, or legal process</li>
          <li>Enforce our Terms of Service</li>
          <li>Protect our rights, property, users, or the public</li>
          <li>Prevent fraud, abuse, security incidents, or illegal activity</li>
          <li>Respond to lawful requests from public authorities</li>
          <li>Support audits, compliance, or dispute resolution</li>
        </ul>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>4.8 Business Transfers</h4>
        <p>
          If we are involved in a merger, acquisition, financing, reorganization, bankruptcy, sale of assets, or
          change of control, information may be transferred as part of that transaction.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>5. Data Security</h3>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect information against
          unauthorized access, loss, misuse, alteration, or disclosure.
        </p>
        <p>These safeguards may include:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>TLS encryption in transit</li>
          <li>Access controls</li>
          <li>Authentication controls</li>
          <li>Role-based permissions</li>
          <li>Logging and monitoring</li>
          <li>Secure third-party infrastructure</li>
          <li>Limited access by authorized personnel</li>
          <li>Service provider security practices</li>
          <li>Backups and recovery processes</li>
        </ul>
        <p>No method of transmission or storage is completely secure. We cannot guarantee absolute security.</p>
        <p>
          You are responsible for maintaining the security of your account, devices, passwords, team access, and
          shared links.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>6. Data Storage and Hosting</h3>
        <p>
          Information may be stored and processed in the United States and other locations where we or our service
          providers operate.
        </p>
        <p>
          By using the Service, you understand that your information may be transferred to, stored in, or processed
          in countries outside your location. Those countries may have data protection laws different from your
          jurisdiction.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>7. Data Retention</h3>
        <p>
          We retain information for as long as reasonably necessary to provide the Service, operate our business,
          comply with legal obligations, resolve disputes, enforce agreements, maintain security, support audits,
          and preserve legitimate business records.
        </p>
        <p>Retention periods may vary depending on the type of data, including:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Account data: retained while your account is active</li>
          <li>
            Project and proposal data: retained while your account is active or as needed for business records
          </li>
          <li>
            Billing and subscription records: retained as needed for accounting, tax, fraud prevention, and legal
            compliance
          </li>
          <li>
            Email event logs: retained as needed for delivery verification, support, abuse prevention, and
            compliance
          </li>
          <li>Security logs: retained as needed for security and fraud prevention</li>
          <li>Backups: retained for a limited period according to backup practices</li>
          <li>
            Deleted account data: deleted or de-identified within a reasonable time unless retention is required by
            law, backup practices, dispute resolution, security, or legitimate business needs
          </li>
        </ul>
        <p>
          If you request account deletion, we will delete or de-identify personal information within a reasonable
          time unless we are required or permitted to retain it.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>8. Your Choices</h3>
        <p>Depending on your location and applicable law, you may have choices regarding your information.</p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>8.1 Account Information</h4>
        <p>
          You may review and update certain account, business, project, client, and proposal information in the
          Service.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>8.2 Location Permissions</h4>
        <p>
          You can disable location access through your browser or device settings. Weather and placement-related
          features may not work properly without location access.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>8.3 Emails and Notifications</h4>
        <p>
          You may receive transactional emails related to your account, proposals, projects, team invites,
          subscriptions, billing, security, or service activity.
        </p>
        <p>
          You may opt out of marketing emails if we send them. You may not be able to opt out of essential
          transactional or security emails.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>8.4 Cookies</h4>
        <p>
          You can manage cookies through your browser settings. Some features may not work if cookies or local
          storage are disabled.
        </p>

        <h4 className={`${LEGAL_MODAL_H4} mt-4 mb-2`}>8.5 Client Portal and Shared Links</h4>
        <p>
          You can manage certain client portal access, invitations, and shared links through the Service where
          available.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>9. Privacy Rights</h3>
        <p>Depending on where you live, you may have rights regarding your personal information.</p>
        <p>These may include the right to:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Access personal information</li>
          <li>Correct inaccurate personal information</li>
          <li>Delete personal information</li>
          <li>Restrict or object to processing</li>
          <li>Request data portability</li>
          <li>Withdraw consent where processing is based on consent</li>
          <li>Opt out of certain data sharing or targeted advertising where applicable</li>
          <li>Appeal a denied privacy request where required by law</li>
          <li>Lodge a complaint with a supervisory authority</li>
        </ul>
        <p>To exercise rights, contact us using the information in the &ldquo;Contact Us&rdquo; section.</p>
        <p>
          We may need to verify your identity before processing a request. We may deny or limit requests where
          allowed by law, such as where retention is required for legal, security, billing, tax, fraud prevention,
          dispute resolution, or operational reasons.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>10. California Privacy Rights</h3>
        <p>
          If you are a California resident, California law may provide rights regarding personal information,
          including the right to know, access, correct, delete, and opt out of certain uses or disclosures.
        </p>
        <p>We may collect the following categories of personal information:</p>
        <ul className={LEGAL_MODAL_LIST_SPACED}>
          <li>
            Identifiers, such as name, email, phone number, IP address, account ID, client information, and business
            contact information
          </li>
          <li>
            Customer records information, such as billing information, business contact details, project records,
            and client records
          </li>
          <li>
            Commercial information, such as subscriptions, proposals, invoices, project values, payments, or
            transaction history
          </li>
          <li>Internet or network activity, such as usage data, log data, device data, and diagnostics</li>
          <li>Geolocation data, such as jobsite location or device location if permission is granted</li>
          <li>
            Professional or employment-related information, such as company, role, team access, contractor data, or
            employee invite data
          </li>
          <li>Inferences or analytics, such as usage patterns, project status, or product engagement</li>
          <li>
            Sensitive personal information only if you choose to provide it or where necessary for specific features
          </li>
        </ul>
        <p>We use these categories for the purposes described in this Privacy Policy.</p>
        <p>
          We do not knowingly sell personal information. If we engage in activities that are considered
          &ldquo;sharing&rdquo; for cross-context behavioral advertising under applicable law, we will provide
          required notices and opt-out mechanisms.
        </p>
        <p>We do not use sensitive personal information to infer characteristics about you.</p>
        <p>California residents may submit requests using the contact information below.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>11. GDPR, UK, and International Privacy Rights</h3>
        <p>
          If you are located in the European Economic Area, United Kingdom, Switzerland, or another jurisdiction
          with similar laws, you may have rights under applicable data protection laws.
        </p>
        <p>These may include:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Access</li>
          <li>Rectification</li>
          <li>Erasure</li>
          <li>Restriction of processing</li>
          <li>Objection</li>
          <li>Data portability</li>
          <li>Withdrawal of consent</li>
          <li>Complaint to a supervisory authority</li>
        </ul>
        <p>
          Where we transfer personal information internationally, we rely on appropriate safeguards where required,
          such as contractual protections, service provider obligations, or other lawful transfer mechanisms.
        </p>
        <p>
          If you are using the Service for business purposes and enter personal information about your clients,
          employees, subcontractors, or other third parties, you are responsible for ensuring you have a lawful basis
          and required notices or consents.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>12. Children&rsquo;s Privacy</h3>
        <p>
          The Service is not directed to children under 13, and we do not knowingly collect personal information
          from children under 13.
        </p>
        <p>
          If you believe a child under 13 has provided personal information to us, contact us and we will take
          appropriate steps to delete it.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>13. Business Customer Responsibilities</h3>
        <p>
          If you use the Service as a contractor, business, employer, or project manager, you may enter personal
          information about clients, employees, subcontractors, suppliers, inspectors, or other third parties.
        </p>
        <p>You are responsible for:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Providing any required privacy notices</li>
          <li>Obtaining any required consents</li>
          <li>Ensuring lawful collection and use</li>
          <li>Managing access permissions</li>
          <li>Avoiding unnecessary sensitive information</li>
          <li>Reviewing shared links and client portal access</li>
          <li>Deleting or correcting information when appropriate</li>
          <li>
            Complying with employment, privacy, consumer protection, contract, and industry-specific laws
          </li>
        </ul>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>14. Sensitive Information</h3>
        <p>
          Do not upload or enter sensitive personal information unless it is necessary and you are authorized to do
          so.
        </p>
        <p>Sensitive information may include:</p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Social Security numbers</li>
          <li>Tax identification numbers</li>
          <li>Government IDs</li>
          <li>Banking information</li>
          <li>Health information</li>
          <li>Biometric information</li>
          <li>Precise personal location unrelated to a project</li>
          <li>Personal information about minors</li>
          <li>Criminal records</li>
          <li>Highly confidential or regulated data</li>
        </ul>
        <p>
          The Service is not designed to store highly sensitive regulated information unless we specifically state
          otherwise in writing.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>15. Analytics and Product Improvement</h3>
        <p>
          We may use analytics and diagnostics to understand how the Service is used, improve features, identify
          errors, test performance, and prioritize development.
        </p>
        <p>
          Analytics may include aggregated or de-identified information. We do not use private project data to
          publicly identify your business without permission.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>16. Artificial Intelligence and Automated Features</h3>
        <p>
          If the Service includes AI-assisted features, automated suggestions, summaries, classification, or
          generated text, we may process the information you provide to generate outputs.
        </p>
        <p>
          We do not use AI outputs as a substitute for your professional judgment. You are responsible for
          reviewing AI-assisted or automated outputs.
        </p>
        <p>
          If third-party AI providers are used in the future, we will update this Policy or provide additional notice
          as required.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>17. Accounting, Tax, and Export Records</h3>
        <p>
          Accounting and tax export tools may process business and financial data, including revenue, proposal values,
          project costs, tax categories, labor costs, expense categories, and export history.
        </p>
        <p>
          These exports are intended to help you maintain business records. You are responsible for reviewing exports
          before providing them to CPAs, tax professionals, accounting software, tax software, clients, or government
          agencies.
        </p>
        <p>
          We may retain export history and related metadata for business record, support, compliance, and audit
          purposes.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>18. QuickBooks, TurboTax, and Third-Party Export Tools</h3>
        <p>
          If the Service provides QuickBooks-related exports, TurboTax helper exports, accounting software exports,
          or other third-party export tools, those features may require processing information in formats intended
          for third-party systems.
        </p>
        <p>
          Use of third-party systems is subject to their own terms and privacy policies. We are not responsible for
          third-party acceptance, processing, storage, security, import errors, mapping issues, or changes to
          third-party platforms.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>19. Public Proposal Links and Share Previews</h3>
        <p>
          The Service may allow public proposal links, share links, social previews, Open Graph previews, or
          client-access links.
        </p>
        <p>
          Information included in shared links or previews may be visible to recipients or platforms that process the
          link. Do not create or share public links unless you are authorized to share the underlying information.
        </p>
        <p>Some platforms may cache preview images, titles, descriptions, or metadata.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>20. Data Deletion and Account Closure</h3>
        <p>You may request deletion of your account by contacting us. We may need to verify your identity.</p>
        <p>
          After account deletion, we will delete or de-identify personal information within a reasonable time unless
          retention is required or permitted for:
        </p>
        <ul className={LEGAL_MODAL_LIST}>
          <li>Legal compliance</li>
          <li>Tax or accounting records</li>
          <li>Billing records</li>
          <li>Fraud prevention</li>
          <li>Security logs</li>
          <li>Dispute resolution</li>
          <li>Backup recovery</li>
          <li>Enforcement of agreements</li>
          <li>Legitimate business purposes</li>
        </ul>
        <p>Deleted data may remain in backups for a limited period before being overwritten.</p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>21. Data Accuracy</h3>
        <p>
          You are responsible for keeping your account, business, project, client, proposal, and billing information
          accurate and up to date.
        </p>
        <p>
          We are not responsible for errors caused by inaccurate, incomplete, outdated, or improperly entered
          information.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>22. Changes to This Privacy Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. When we update it, we will revise the &ldquo;Last
          Updated&rdquo; date.
        </p>
        <p>
          If changes are material, we may provide notice by email, in-app notice, or other reasonable means. Your
          continued use of the Service after the updated Policy becomes effective means you accept the updated
          Policy.
        </p>
      </section>

      <section className={LEGAL_MODAL_SECTION}>
        <h3 className={`${LEGAL_MODAL_H3} mb-2`}>23. Contact Us</h3>
        <p>
          If you have questions about this Privacy Policy or want to exercise privacy rights, contact us at:
        </p>
        <address className="not-italic mt-2 space-y-1">
          <p>
            <strong>ConcreteCalc, LLC</strong>
          </p>
          <p>
            Email:{' '}
            <a href="mailto:support@concrete-calc.com" className={LEGAL_MODAL_LINK}>
              support@concrete-calc.com
            </a>
          </p>
          <p>
            <strong>Address:</strong> [Insert Legal Business Mailing Address]
          </p>
        </address>
        <p className={LEGAL_MODAL_META}>
          Do not publish a placeholder address. Use your actual legal business mailing address or registered business
          address before making this Privacy Policy public.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
