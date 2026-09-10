import crypto from "crypto";
import jwt from "jsonwebtoken";

import ChatFaq from "@/app/backend/models/chatFaq";
import SupportTicket from "@/app/backend/models/supportTicket";
import ParkingUser from "@/app/backend/models/park_user";
import { sendSupportTicketCreatedEmails } from "@/app/backend/utils/supportTicketEmail";

const DEFAULT_FAQS = [
  {
    question: "How can I cancel my booking?",
    keywords: ["cancel", "cancel booking", "cancellation"],
    answer:
      "You can request cancellation from Customer Dashboard → My Bookings → Cancel. Admin will review your request and notify you by email.",
  },
  {
    question: "How does Pay on Arrival work?",
    keywords: ["pay on arrival", "poa", "arrival payment", "deposit"],
    answer:
      "Pay on Arrival means you pay a holding deposit online and the remaining balance when you arrive at the parking location.",
  },
  {
    question: "How do I edit my license plate?",
    keywords: ["license", "plate", "car plate", "edit booking"],
    answer:
      "Login to Customer Dashboard → My Bookings → Edit. Cruise and Airport bookings allow license plate and shuttle option changes. Storage bookings allow reference/license plate changes.",
  },
  {
    question: "How do I top up my wallet?",
    keywords: ["wallet", "top up", "add money", "balance"],
    answer:
      "Login to Customer Dashboard → Dashboard → Top Up Wallet. You can top up using Stripe or PayPal if enabled.",
  },
  {
    question: "How do I request a wallet withdrawal?",
    keywords: ["withdraw", "withdrawal", "payout", "wallet money"],
    answer:
      "Login to Customer Dashboard → Withdraw Request. Enter the amount and payout details. Admin will review and process the request manually.",
  },
  {
    question: "Where can I see my bookings?",
    keywords: ["my bookings", "booking history", "dashboard"],
    answer:
      "Login to your account and go to Customer Dashboard → My Bookings to view all your booking details, payment status, and actions.",
  },
  {
    question: "Do you provide shuttle service?",
    keywords: ["shuttle", "pickup", "drop off", "transport"],
    answer:
      "Shuttle options depend on the booking type and location. During booking, available shuttle times will be shown when shuttle service is enabled.",
  },
];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeSearchText(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchScore(question, faq) {
  const normalizedQuestion = normalizeSearchText(question);
  const normalizedFaqQuestion = normalizeSearchText(faq.question);
  const normalizedAnswer = normalizeSearchText(faq.answer);

  if (!normalizedQuestion) return 0;

  let score = 0;

  if (normalizedFaqQuestion.includes(normalizedQuestion)) {
    score += 8;
  }

  if (normalizedQuestion.includes(normalizedFaqQuestion)) {
    score += 8;
  }

  const keywords = Array.isArray(faq.keywords) ? faq.keywords : [];

  keywords.forEach((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);

    if (!normalizedKeyword) return;

    if (normalizedQuestion.includes(normalizedKeyword)) {
      score += 5;
    }
  });

  const questionWords = normalizedQuestion
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

  questionWords.forEach((word) => {
    if (normalizedFaqQuestion.includes(word)) {
      score += 1;
    }

    if (normalizedAnswer.includes(word)) {
      score += 0.5;
    }
  });

  return score;
}

async function getOptionalCustomer(req) {
  try {
    const header = req.headers.get("authorization") || "";

    if (!header.startsWith("Bearer ")) {
      return null;
    }

    if (!process.env.JWT_SECRET) {
      return null;
    }

    const token = header.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id || decoded.sub;

    if (!userId) {
      return null;
    }

    return await ParkingUser.findOne({
      _id: userId,
      is_active: true,
    }).select("name email phone role");
  } catch {
    return null;
  }
}

async function generateTicketId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ticketId = `TKT-${Date.now()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const exists = await SupportTicket.exists({ ticket_id: ticketId });

    if (!exists) {
      return ticketId;
    }
  }

  throw new Error("Failed to generate ticket ID");
}

function getErrorStatus(message = "") {
  const value = String(message || "").toLowerCase();

  if (value.includes("required")) return 400;
  if (value.includes("valid email")) return 400;
  if (value.includes("not found")) return 404;

  return 400;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export async function askChatQuestion(req) {
  try {
    const body = await req.json();
    const question = normalizeString(body.question || body.message);

    if (!question) {
      throw new Error("Question is required");
    }

    const dbFaqs = await ChatFaq.find({
      is_active: true,
    })
      .sort({
        sort_order: 1,
        createdAt: -1,
      })
      .lean();

    const faqs = dbFaqs.length > 0 ? dbFaqs : DEFAULT_FAQS;

    let bestFaq = null;
    let bestScore = 0;

    faqs.forEach((faq) => {
      const score = getMatchScore(question, faq);

      if (score > bestScore) {
        bestScore = score;
        bestFaq = faq;
      }
    });

    if (bestFaq && bestScore >= 4) {
      return Response.json({
        success: true,
        matched: true,
        data: {
          type: "faq_answer",
          question: bestFaq.question,
          answer: bestFaq.answer,
          score: bestScore,
        },
      });
    }

    return Response.json({
      success: true,
      matched: false,
      data: {
        type: "ticket_prompt",
        answer:
          "I could not find an exact answer for this question. Please submit a support ticket and our admin team will review it.",
      },
    });
  } catch (error) {
    console.error("Chat ask failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to process chat question",
        error: error.message || "Failed to process chat question",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function createSupportTicket(req) {
  try {
    const customer = await getOptionalCustomer(req);
    const body = await req.json();

    const name = normalizeString(body.name || customer?.name);
    const email = normalizeString(body.email || customer?.email).toLowerCase();
    const phone = normalizeString(body.phone || customer?.phone);
    const bookingId = normalizeString(body.booking_id || body.bookingId);
    const message = normalizeString(body.message);

    if (!name) {
      throw new Error("Name is required");
    }

    if (!email || !isValidEmail(email)) {
      throw new Error("A valid email is required");
    }

    if (!phone) {
      throw new Error("Phone is required");
    }

    if (!message || message.length < 5) {
      throw new Error("Message is required");
    }

    const ticket = await SupportTicket.create({
      ticket_id: await generateTicketId(),
      customer_id: customer?._id || null,
      name,
      email,
      phone,
      booking_id: bookingId,
      message,
      status: "open",
      priority: "normal",
      source: customer ? "customer_dashboard" : "chat_widget",
    });

    let emailResult = null;

    try {
      emailResult = await sendSupportTicketCreatedEmails(ticket);
    } catch (emailError) {
      console.error("Support ticket email failed:", emailError);
      emailResult = {
        adminSent: false,
        customerSent: false,
        errors: [emailError.message],
      };
    }

    return Response.json(
      {
        success: true,
        message:
          emailResult?.errors?.length > 0
            ? "Support ticket created, but one or more emails may not have been sent."
            : "Support ticket submitted successfully.",
        data: {
          ticket,
          emailResult,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Support ticket create failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to submit support ticket",
        error: error.message || "Failed to submit support ticket",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}

export async function getCustomerSupportTickets(req) {
  try {
    const customer = await getOptionalCustomer(req);

    if (!customer?._id) {
      throw new Error("Unauthorized. Please login again.");
    }

    const tickets = await SupportTicket.find({
      $or: [
        {
          customer_id: customer._id,
        },
        {
          email: customer.email,
        },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({
      success: true,
      data: {
        tickets,
      },
    });
  } catch (error) {
    console.error("Customer support tickets fetch failed:", error);

    return Response.json(
      {
        success: false,
        message: error.message || "Failed to fetch support tickets",
        error: error.message || "Failed to fetch support tickets",
      },
      { status: getErrorStatus(error.message) }
    );
  }
}