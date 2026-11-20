import { useEffect } from "react";
import { Link } from "react-router";
import { PublicFooter, PublicHeader, policyLinks } from "../../components/layout/PublicChrome";

const policies = {
  disclaimer: {
    title: "Disclaimer",
    summary: "What to expect when you use Safar to estimate, book or track a delivery.",
    sections: [
      ["Estimates and availability", "A fare estimate uses the route, vehicle and load information you enter. Vehicle availability can change. A request is assigned only after an eligible driver accepts it."],
      ["Tracking and timing", "Map positions, route information and estimated times depend on available location and mapping data. Updates can be delayed or interrupted. Check your booking details for the latest status before making time-sensitive arrangements."],
      ["Business enquiries", "Sending an enquiry asks Safar to review your delivery needs and follow up. It does not create a booking, business account or billing arrangement."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    summary: "How information entered in the Safar website is used to provide its features.",
    sections: [
      ["Account information", "Safar uses the details you submit during registration, sign-in and password recovery to manage your account and provide access to your workspace."],
      ["Bookings and enquiries", "Pickup and drop-off addresses, shipment descriptions, weight and vehicle selections are used to calculate estimates and coordinate bookings. Contact details and shipment requirements submitted in the business enquiry form are used to review and respond to the enquiry."],
      ["Driver verification and live location", "Driver onboarding uses the profile details, documents and vehicle photos submitted for verification. When a driver enables live location, location updates can be used to show the assigned driver’s position in booking tracking."],
      ["Browser storage and maps", "Safar uses browser storage for features such as remembered sign-in email, selected city and booking drafts. Clearing site data from your browser removes locally stored preferences and drafts. Address lookup and maps may send address queries or coordinates to mapping services to display locations and routes."],
      ["Access to booking information", "Booking information is available through the customer, assigned-driver and administrator views as needed to coordinate and manage delivery. Avoid adding sensitive personal details to package descriptions or enquiry notes."],
      ["Questions about your information", "Signed-in customers can use Booking support for questions about information associated with a booking. For account information, start by checking the profile in your workspace."],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    summary: "Responsibilities when you use a Safar account or request a delivery.",
    sections: [
      ["Your account", "Provide accurate account details, keep your sign-in credentials private and use the workspace that matches your role."],
      ["Delivery requests", "Provide accurate pickup and drop-off details, describe the contents and weight, and select a vehicle that can carry the load. Check the route and estimated fare before confirming."],
      ["Dispatch and tracking", "Submitting a booking creates a request. An eligible driver must accept the offer before assignment. The public estimate page does not take payment. Use your booking details to check assignment and delivery status."],
      ["Goods and safe handling", "Only request transport for goods you are permitted to send. Package them securely and disclose any special handling requirements when making your request. Do not use Safar to send unlawful or undeclared hazardous goods."],
      ["Booking issues", "Use Booking support for a delivery concern and include the booking reference so the issue can be identified. Keep your own record of the booking and any related correspondence."],
    ],
  },
} as const;

export default function PolicyPage({ policy }: { policy: keyof typeof policies }) {
  const { title, summary, sections } = policies[policy];

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Safar`;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <div className="lgh safar-policy-page">
      <PublicHeader />
      <main className="lgh-wrap safar-policy">
        <header>
          <p className="lgh-eyebrow">Safar Logistics</p>
          <h1>{title}</h1>
          <p>{summary}</p>
        </header>
        <article>
          {sections.map(([heading, text]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{text}</p>
            </section>
          ))}
          <Link className="lgh-text-link" to="/customer/complaints">Booking support</Link>
        </article>
        <nav aria-label="Related policies">
          {policyLinks.filter(({ label }) => label !== title).map(({ to, label }) => (
            <Link key={to} to={to}>{label}</Link>
          ))}
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
