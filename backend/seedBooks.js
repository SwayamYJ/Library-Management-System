require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const User = require('./models/User');
const Activity = require('./models/Activity');
const BorrowingHistory = require('./models/BorrowingHistory');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const booksData = [
    // Mechanics
    { Title: "Engineering Mechanics: Statics", Author: "J.L. Meriam", ISBN: "9781118919736", Category: "Mechanics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 1 } },
    { Title: "Engineering Mechanics: Dynamics", Author: "J.L. Meriam", ISBN: "9781118885840", Category: "Mechanics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 2 } },
    { Title: "Fluid Mechanics", Author: "Frank M. White", ISBN: "9780073398273", Category: "Mechanics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 3 } },
    { Title: "Mechanics of Materials", Author: "R.C. Hibbeler", ISBN: "9780134319650", Category: "Mechanics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 4 } },
    { Title: "Classical Mechanics", Author: "Herbert Goldstein", ISBN: "9780201657029", Category: "Mechanics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 5 } },

    // Programming
    { Title: "The C Programming Language", Author: "Brian W. Kernighan", ISBN: "9780131103627", Category: "Programming", price: 500, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 1 } },
    { Title: "Introduction to Algorithms", Author: "Thomas H. Cormen", ISBN: "9780262033848", Category: "Programming", price: 800, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 2 } },
    { Title: "Clean Code", Author: "Robert C. Martin", ISBN: "9780132350884", Category: "Programming", price: 700, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 3 } },
    { Title: "Data Structures Using C", Author: "Reema Thareja", ISBN: "9780198099307", Category: "Programming", price: 400, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 4 } },
    { Title: "Design Patterns", Author: "Erich Gamma", ISBN: "9780201633610", Category: "Programming", price: 900, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 5 } },

    // Physics
    { Title: "Fundamentals of Physics", Author: "David Halliday", ISBN: "9781118230718", Category: "Physics", price: 650, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 6 } },
    { Title: "Concepts of Physics Vol 1", Author: "H.C. Verma", ISBN: "9788177091878", Category: "Physics", price: 450, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 7 } },
    { Title: "Concepts of Physics Vol 2", Author: "H.C. Verma", ISBN: "9788177092325", Category: "Physics", price: 450, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 8 } },
    { Title: "University Physics", Author: "Hugh D. Young", ISBN: "9780321973610", Category: "Physics", price: 700, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 9 } },
    { Title: "Introduction to Electrodynamics", Author: "David J. Griffiths", ISBN: "9780321856562", Category: "Physics", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "A", slotIndex: 10 } },

    // Mathematics
    { Title: "Advanced Engineering Mathematics", Author: "Erwin Kreyszig", ISBN: "9780470458365", Category: "Mathematics", price: 850, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 6 } },
    { Title: "Calculus: Early Transcendentals", Author: "James Stewart", ISBN: "9781285741550", Category: "Mathematics", price: 800, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 7 } },
    { Title: "Linear Algebra and Its Applications", Author: "Gilbert Strang", ISBN: "9780030105678", Category: "Mathematics", price: 500, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 8 } },
    { Title: "Discrete Mathematics", Author: "Kenneth H. Rosen", ISBN: "9780073383095", Category: "Mathematics", price: 550, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 9 } },
    { Title: "Higher Engineering Mathematics", Author: "B.S. Grewal", ISBN: "9788174091956", Category: "Mathematics", price: 400, Location: { floor: "1", section: "Engineering", shelfNumber: "B", slotIndex: 10 } },

    // DBMS
    { Title: "Database System Concepts", Author: "Abraham Silberschatz", ISBN: "9780073523323", Category: "DBMS", price: 750, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 1 } },
    { Title: "Fundamentals of Database Systems", Author: "Ramez Elmasri", ISBN: "9780133970777", Category: "DBMS", price: 700, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 2 } },
    { Title: "Database Management Systems", Author: "Raghu Ramakrishnan", ISBN: "9780072465631", Category: "DBMS", price: 650, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 3 } },
    { Title: "Learning SQL", Author: "Alan Beaulieu", ISBN: "9781492057611", Category: "DBMS", price: 450, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 4 } },
    { Title: "SQL Performance Explained", Author: "Markus Winand", ISBN: "9783950307825", Category: "DBMS", price: 500, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 5 } },

    // TOC
    { Title: "Introduction to the Theory of Computation", Author: "Michael Sipser", ISBN: "9781133187790", Category: "TOC", price: 600, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 6 } },
    { Title: "Automata Theory, Languages, and Computation", Author: "John E. Hopcroft", ISBN: "9780321455369", Category: "TOC", price: 650, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 7 } },
    { Title: "Elements of the Theory of Computation", Author: "Harry R. Lewis", ISBN: "9780132624787", Category: "TOC", price: 580, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 8 } },
    { Title: "Computability and Complexity", Author: "Neil D. Jones", ISBN: "9780262100649", Category: "TOC", price: 700, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 9 } },
    { Title: "An Introduction to Formal Languages", Author: "Peter Linz", ISBN: "9781284077247", Category: "TOC", price: 550, Location: { floor: "1", section: "Engineering", shelfNumber: "C", slotIndex: 10 } }
];

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Clearing existing books...');
        await Book.deleteMany({});

        console.log('Inserting 30 Engineering Books...');
        const insertedBooks = await Book.insertMany(booksData);
        console.log(`Successfully inserted ${insertedBooks.length} books.`);

        // Link notification logic
        console.log('Finding a User to assign dummy overdue activity...');
        const user = await User.findOne({ role: 'User' });

        if (user && insertedBooks.length > 0) {
            // Clear existing dummy activities for clean state
            await Activity.deleteMany({ userId: user._id });

            // Create an overdue book (Penalty: 3 days overdue * 10 = ₹30)
            const overdueDate = new Date();
            overdueDate.setDate(overdueDate.getDate() - 3);

            const act1 = new Activity({
                userId: user._id,
                bookId: insertedBooks[0]._id, // Engineering Mechanics
                action: 'Issue',
                status: 'Active',
                dueDate: overdueDate
            });
            await act1.save();

            // Create a warning book (Due tomorrow)
            const warningDate = new Date();
            warningDate.setDate(warningDate.getDate() + 1);

            const act2 = new Activity({
                userId: user._id,
                bookId: insertedBooks[1]._id, // Programming
                action: 'Issue',
                status: 'Active',
                dueDate: warningDate
            });
            await act2.save();

            console.log(`Generated Overdue & Warning test entries for user: ${user.username}`);
        } else {
            console.log('No user found to assign activities.');
        }

        mongoose.connection.close();
        console.log('Seed Complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seed();
