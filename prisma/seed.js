const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🌱 Starting seed...");

    // 1. Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    const admin = await prisma.user.upsert({
      where: { email: "admin@melodystore.com" },
      update: {
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
      create: {
        email: "admin@melodystore.com",
        username: "admin",
        password: hashedPassword,
        firstName: "Super",
        lastName: "Admin",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log("✅ Admin user created:", admin.email);

    // 2. Create categories
    const categories = [
      { name: "Pianos", description: "Grand and upright pianos", icon: "🎹" },
      {
        name: "Guitars",
        description: "Acoustic and electric guitars",
        icon: "🎸",
      },
      { name: "Strings", description: "Violins, cellos, and more", icon: "🎻" },
      { name: "Drums", description: "Drum kits and percussion", icon: "🥁" },
      { name: "Wind", description: "Flutes, clarinets, and more", icon: "🎷" },
    ];

    for (const category of categories) {
      await prisma.category.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      });
    }
    console.log("✅ Categories created");

    // 3. Get category IDs for products
    const categoryMap = await prisma.category.findMany();
    const pianoCategory = categoryMap.find((c) => c.name === "Pianos");
    const guitarCategory = categoryMap.find((c) => c.name === "Guitars");
    const stringsCategory = categoryMap.find((c) => c.name === "Strings");
    const drumsCategory = categoryMap.find((c) => c.name === "Drums");

    // 4. Create sample products
    const products = [];

    if (pianoCategory) {
      products.push({
        name: "Yamaha C3X Grand Piano",
        description:
          "Premium grand piano with rich, resonant tones. Features a handcrafted soundboard and Renner action mechanism.",
        price: 24999,
        stock: 5,
        categoryId: pianoCategory.id,
        images: [
          "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&h=400&fit=crop",
        ],
        badge: "Premium",
        rating: 4.9,
        reviewsCount: 127,
      });
    }

    if (guitarCategory) {
      products.push({
        name: "Gibson Les Paul Standard",
        description:
          "Iconic electric guitar with mahogany body and maple top. Perfect for rock and blues.",
        price: 2499,
        stock: 10,
        categoryId: guitarCategory.id,
        images: [
          "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop",
        ],
        badge: "Best Seller",
        rating: 4.8,
        reviewsCount: 89,
      });

      products.push({
        name: "Fender American Professional II",
        description:
          "Professional-grade electric guitar with versatile pickups and smooth playability.",
        price: 1599,
        stock: 8,
        categoryId: guitarCategory.id,
        images: [
          "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop",
        ],
        badge: "New",
        rating: 4.6,
        reviewsCount: 112,
      });
    }

    if (stringsCategory) {
      products.push({
        name: "Stradivarius Violin",
        description:
          "Masterpiece of craftsmanship with unparalleled sound quality. Handcrafted with premium tonewoods.",
        price: 15999,
        stock: 3,
        categoryId: stringsCategory.id,
        images: [
          "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=400&fit=crop",
        ],
        badge: "Luxury",
        rating: 5.0,
        reviewsCount: 45,
      });
    }

    if (drumsCategory) {
      products.push({
        name: "DW Design Series Drum Kit",
        description:
          "Professional drum kit with premium maple shells and innovative hardware. Includes full hardware pack.",
        price: 3299,
        stock: 8,
        categoryId: drumsCategory.id,
        images: [
          "https://images.unsplash.com/photo-1525201548942-d8732f6617a0?w=400&h=400&fit=crop",
        ],
        badge: "Pro",
        rating: 4.7,
        reviewsCount: 63,
      });
    }

    if (products.length > 0) {
      for (const product of products) {
        await prisma.product.upsert({
          where: { id: product.id || "" },
          update: {},
          create: product,
        });
      }
      console.log(`✅ ${products.length} sample products created`);
    }

    console.log("🎵 Database seeded successfully!");
    console.log("📧 Admin email: admin@melodystore.com");
    console.log("🔑 Admin password: admin123");
  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
