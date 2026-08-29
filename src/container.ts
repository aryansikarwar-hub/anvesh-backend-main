import { type AppConfig } from './lib/config';
import { createMailer, type Mailer } from './infra/mailer';
import { createAiProvider, type AiProvider } from './infra/ai';
import { RazorpayClient } from './infra/payments/razorpay.client';
import { FileStorage } from './infra/storage/local.storage';
import { QueuePublisher, createQueuePublisher } from './infra/queue';
import { type JobRunner } from './jobs/runner';

import { AuthRepository } from './modules/auth/auth.repository';
import { TokenService } from './modules/auth/token.service';
import { TotpService } from './modules/auth/totp.service';
import { AccountService } from './modules/auth/account.service';
import { AuthService } from './modules/auth/auth.service';
import { AdminAuthService } from './modules/auth/admin-auth.service';
import { AuthController } from './modules/auth/auth.controller';
import { AdminAuthController } from './modules/auth/admin-auth.controller';

import { UserRepository } from './modules/users/user.repository';
import { UserService } from './modules/users/user.service';
import { UserController } from './modules/users/user.controller';

import { GuideRepository } from './modules/guides/guide.repository';
import { GuideService } from './modules/guides/guide.service';
import { GuideDashboardService } from './modules/guides/guide.dashboard.service';
import { GuideController } from './modules/guides/guide.controller';

import { PlaceRepository } from './modules/places/place.repository';
import { PlaceService } from './modules/places/place.service';
import { PlaceController } from './modules/places/place.controller';

import { DiscoveryRepository } from './modules/discovery/discovery.repository';
import { DiscoveryService } from './modules/discovery/discovery.service';
import { DiscoveryController } from './modules/discovery/discovery.controller';
import { RecommendationService } from './modules/recommendations/recommendation.service';
import { TaxonomyService } from './modules/taxonomy/taxonomy.service';

import { ExperienceRepository } from './modules/experiences/experience.repository';
import { ExperienceService } from './modules/experiences/experience.service';
import { ExperienceController } from './modules/experiences/experience.controller';
import { AvailabilityRepository } from './modules/availability/availability.repository';
import { AvailabilityService } from './modules/availability/availability.service';

import { BookingRepository } from './modules/bookings/booking.repository';
import { BookingService } from './modules/bookings/booking.service';
import { BookingController } from './modules/bookings/booking.controller';

import { PaymentRepository } from './modules/payments/payment.repository';
import { PaymentService } from './modules/payments/payment.service';
import { RefundService } from './modules/payments/refund.service';
import { WebhookService } from './modules/payments/webhook.service';
import { PaymentController } from './modules/payments/payment.controller';

import { StoryRepository } from './modules/stories/story.repository';
import { StoryService } from './modules/stories/story.service';
import { StoryController } from './modules/stories/story.controller';

import { ReviewRepository } from './modules/reviews/review.repository';
import { ReviewService } from './modules/reviews/review.service';
import { ReviewController } from './modules/reviews/review.controller';

import { TripRepository } from './modules/trips/trip.repository';
import { TripService } from './modules/trips/trip.service';
import { TripController } from './modules/trips/trip.controller';

import { AiService } from './modules/ai/ai.service';
import { AiController } from './modules/ai/ai.controller';

import { MediaService } from './modules/media/media.service';
import { NotificationService } from './modules/notifications/notification.service';

import { AuditService } from './modules/admin/audit.service';
import { AdminUsersService } from './modules/admin/admin.users.service';
import { AdminModerationService } from './modules/admin/admin.moderation.service';
import { AdminAnalyticsService } from './modules/admin/admin.analytics.service';
import { AdminController } from './modules/admin/admin.controller';

/**
 * Explicit constructor wiring for the whole API.
 *
 * Every dependency edge in the application is visible in this one file. There
 * is no decorator magic and no service locator, which makes the graph easy to
 * read and every service trivially testable with hand-made fakes.
 */
export interface Container {
  config: AppConfig;
  mailer: Mailer;
  aiProvider: AiProvider;
  razorpay: RazorpayClient;
  storage: FileStorage;
  queue: QueuePublisher;
  jobs: JobRunner;
  tokens: TokenService;
  totp: TotpService;
  repositories: {
    auth: AuthRepository;
    users: UserRepository;
    guides: GuideRepository;
    places: PlaceRepository;
    discovery: DiscoveryRepository;
    experiences: ExperienceRepository;
    availability: AvailabilityRepository;
    bookings: BookingRepository;
    payments: PaymentRepository;
    reviews: ReviewRepository;
    stories: StoryRepository;
    trips: TripRepository;
  };
  services: {
    auth: AuthService;
    accounts: AccountService;
    adminAuth: AdminAuthService;
    users: UserService;
    guides: GuideService;
    guideDashboard: GuideDashboardService;
    places: PlaceService;
    discovery: DiscoveryService;
    recommendations: RecommendationService;
    taxonomy: TaxonomyService;
    experiences: ExperienceService;
    availability: AvailabilityService;
    bookings: BookingService;
    payments: PaymentService;
    refunds: RefundService;
    webhooks: WebhookService;
    reviews: ReviewService;
    stories: StoryService;
    trips: TripService;
    ai: AiService;
    media: MediaService;
    notifications: NotificationService;
    audit: AuditService;
    adminUsers: AdminUsersService;
    adminModeration: AdminModerationService;
    adminAnalytics: AdminAnalyticsService;
  };
  controllers: {
    auth: AuthController;
    adminAuth: AdminAuthController;
    users: UserController;
    guides: GuideController;
    places: PlaceController;
    discovery: DiscoveryController;
    experiences: ExperienceController;
    bookings: BookingController;
    payments: PaymentController;
    reviews: ReviewController;
    stories: StoryController;
    trips: TripController;
    ai: AiController;
    admin: AdminController;
  };
}

export function createContainer(config: AppConfig): Container {
  const { env } = config;

  // --- infrastructure ------------------------------------------------------
  const mailer = createMailer(env);
  const aiProvider = createAiProvider(env);
  const storage = new FileStorage(env);
  const razorpay = new RazorpayClient(
    env.RAZORPAY_KEY_ID,
    env.RAZORPAY_KEY_SECRET,
    env.RAZORPAY_WEBHOOK_SECRET,
  );
  const { queue, runner: jobs } = createQueuePublisher(env);
  const tokens = new TokenService(env);
  const totp = new TotpService(env.TOTP_ENCRYPTION_KEY, env.TOTP_ISSUER);

  // --- repositories --------------------------------------------------------
  const authRepository = new AuthRepository();
  const userRepository = new UserRepository();
  const guideRepository = new GuideRepository();
  const placeRepository = new PlaceRepository();
  const discoveryRepository = new DiscoveryRepository();
  const experienceRepository = new ExperienceRepository();
  const availabilityRepository = new AvailabilityRepository();
  const bookingRepository = new BookingRepository();
  const paymentRepository = new PaymentRepository();
  const reviewRepository = new ReviewRepository();
  const storyRepository = new StoryRepository();
  const tripRepository = new TripRepository();

  // --- services ------------------------------------------------------------
  const accounts = new AccountService(authRepository, tokens, mailer, env);
  const auth = new AuthService(authRepository, guideRepository, tokens, accounts, env);
  const adminAuth = new AdminAuthService(authRepository, tokens, totp, auth, mailer, env);
  const users = new UserService(userRepository, authRepository);
  const notifications = new NotificationService();

  const recommendations = new RecommendationService();
  const discovery = new DiscoveryService(discoveryRepository, recommendations, userRepository);
  const taxonomy = new TaxonomyService();
  const places = new PlaceService(placeRepository, guideRepository);
  const experiences = new ExperienceService(
    experienceRepository,
    guideRepository,
    placeRepository,
  );
  const availability = new AvailabilityService(
    availabilityRepository,
    guideRepository,
    experienceRepository,
  );
  const bookings = new BookingService(
    bookingRepository,
    availabilityRepository,
    experienceRepository,
    guideRepository,
    authRepository,
    env,
  );
  const payments = new PaymentService(
    paymentRepository,
    bookingRepository,
    experienceRepository,
    guideRepository,
    authRepository,
    razorpay,
    queue,
    env,
  );
  const refunds = new RefundService(paymentRepository, bookingRepository, guideRepository, razorpay);
  const webhooks = new WebhookService(paymentRepository, bookingRepository, razorpay);
  const guides = new GuideService(guideRepository, bookingRepository, env.TOTP_ENCRYPTION_KEY);
  const guideDashboard = new GuideDashboardService(guideRepository);
  const reviews = new ReviewService(
    reviewRepository,
    placeRepository,
    experienceRepository,
    bookingRepository,
    authRepository,
  );
  const stories = new StoryService(storyRepository, guideRepository);
  const trips = new TripService(tripRepository, placeRepository, experienceRepository);
  const ai = new AiService(aiProvider, discoveryRepository, env);
  const media = new MediaService(storage);

  const audit = new AuditService();
  const adminUsers = new AdminUsersService(audit);
  const adminModeration = new AdminModerationService(
    placeRepository,
    experienceRepository,
    reviewRepository,
    storyRepository,
    notifications,
    audit,
  );
  const adminAnalytics = new AdminAnalyticsService();

  return {
    config,
    mailer,
    aiProvider,
    razorpay,
    storage,
    queue,
    jobs,
    tokens,
    totp,
    repositories: {
      auth: authRepository,
      users: userRepository,
      guides: guideRepository,
      places: placeRepository,
      discovery: discoveryRepository,
      experiences: experienceRepository,
      availability: availabilityRepository,
      bookings: bookingRepository,
      payments: paymentRepository,
      reviews: reviewRepository,
      stories: storyRepository,
      trips: tripRepository,
    },
    services: {
      auth,
      accounts,
      adminAuth,
      users,
      guides,
      guideDashboard,
      places,
      discovery,
      recommendations,
      taxonomy,
      experiences,
      availability,
      bookings,
      payments,
      refunds,
      webhooks,
      reviews,
      stories,
      trips,
      ai,
      media,
      notifications,
      audit,
      adminUsers,
      adminModeration,
      adminAnalytics,
    },
    controllers: {
      auth: new AuthController(auth, accounts, env),
      adminAuth: new AdminAuthController(adminAuth, auth, env),
      users: new UserController(users),
      guides: new GuideController(guides, guideDashboard, bookings, availability, experiences, reviews),
      places: new PlaceController(places),
      discovery: new DiscoveryController(discovery),
      experiences: new ExperienceController(experiences, availability),
      bookings: new BookingController(bookings),
      payments: new PaymentController(payments, webhooks),
      reviews: new ReviewController(reviews),
      stories: new StoryController(stories),
      trips: new TripController(trips),
      ai: new AiController(ai, trips),
      admin: new AdminController(
        adminUsers,
        adminModeration,
        adminAnalytics,
        audit,
        bookingRepository,
        paymentRepository,
        refunds,
        recommendations,
        auth,
      ),
    },
  };
}
