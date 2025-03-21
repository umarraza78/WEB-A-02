const Student = require("../models/Student");
const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
    const { username, password } = req.body;
    console.log("Login attempt:", { username });

    try {
        if (!username || !password) {
            return res.render("login", { 
                error: "Please provide both roll number/email/username and password" 
            });
        }

       
        let user = await Student.findOne({ rollNumber: username });
        let role = "student";
        console.log("Student search by roll number:", user ? "Found" : "Not found");

       
        if (!user) {
            user = await Student.findOne({ email: username });
            console.log("Student search by email:", user ? "Found" : "Not found");
        }

      
        if (!user) {
            user = await Admin.findOne({ username });
            role = "admin";
            console.log("Admin search result:", user ? "Found" : "Not found");
        }

        if (!user) {
            return res.render("login", { 
                error: "Invalid roll number, email, or username. Please try again." 
            });
        }

        console.log("Comparing passwords");
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match:", isMatch);

        if (!isMatch) {
            return res.render("login", { 
                error: "Invalid password. Please try again." 
            });
        }

        req.session.user = { 
            id: user._id, 
            username: role === "student" ? user.rollNumber : user.username,
            role,
            name: user.name,
            rollNumber: role === "student" ? user.rollNumber : undefined
        };
        console.log("Session created:", req.session.user);

       
        if (role === "student") 
            {
            return res.redirect("/student/dashboard");
        } else {
            return res.redirect("/admin/dashboard");
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.render("login", { 
            error: "An error occurred during login. Please try again." 
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
        }
        res.redirect("/");
    });
};
