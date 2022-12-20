const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')

require('dotenv').config();
// middleware start

app.use(cors())
app.use(express.json());

// middleware end

// Mongo DB User Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.kystxht.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Main Function & All Action

function verifyJWT(req, res, next) {
    console.log(req.headers.authorization)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized')
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}
async function run() {

    try {
        const appointmentOptionCollections = client.db('doctorPortal').collection('ApmOptions')
        const bookingsCollection = client.db('doctorPortal').collection('bookings')
        const usersCollection = client.db('doctorPortal').collection('users')

        // All Appointment Options 
        app.get('/appointmentOptions', async (req, res) => {
            const date = req.query.date;
            const query = {}
            const options = await appointmentOptionCollections.find(query).toArray();

            const bookingQuery = { appointmentDate: date }
            const allReadyBooked = await bookingsCollection.find(bookingQuery).toArray();

            options.forEach(option => {
                const booked = allReadyBooked.filter(book => book.treatment === option.name)
                const bookedSlots = booked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
                option.slots = remainingSlots;
            })

            res.send(options)
        })
        app.post('/bookings', async (req, res) => {
            const bookings = req.body;
            const query = {
                appointmentDate: bookings.appointmentDate,
                email: bookings.email,
                treatment: bookings.treatment
            }
            const allReadyBooked = await bookingsCollection.find(query).toArray();

            if (allReadyBooked.length) {
                const message = `You have all ready book ${bookings.appointmentDate}`;
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(bookings);
            res.send(result)
        })

        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { email: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings)
        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: 'token' })
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const newUser = await usersCollection.find(query).toArray();
            res.send(newUser)
        })
        app.get('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options)
            res.send(result);
        })
    }
    finally {

    }


}
run().catch(error => console.error(error))

// Api Root Directory
app.get('/', (req, res) => {
    res.send('Doctor Portal Api Running');
})
// Api Listen Port 
app.listen(port, () => {
    console.log(`Doctor Portal Api Running In ${port}`)
})