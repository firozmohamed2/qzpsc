const firebaseConfig = {
  apiKey: "AIzaSyA88fPkOvcI4QA9qD3ROpk-ay-V6ibQQlc",
  authDomain: "my-application-7fd40.firebaseapp.com",
  projectId: "my-application-7fd40",
  storageBucket: "my-application-7fd40.appspot.com",
  messagingSenderId: "269589994279",
  appId: "1:269589994279:web:4c617a622c328a1224e702",
  measurementId: "G-D8MD1J28GR",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let quiz = [];
let answered = {};
let answeredNow = {};
let currentTopic = "";
let wrongClicks = {};
let wrongClicksNow = {};
let shuffleNow = false;

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function loadTopics() {
  db.collection("quizi")
    .get()
    .then((snapshot) => {
      const topicsDiv = document.getElementById("topicsList");
      topicsDiv.innerHTML = "";
      snapshot.forEach((doc) => {
        const topic = doc.id;
        const btn = document.createElement("div");
        btn.className = "topic";
        btn.innerText = topic;
        btn.onclick = () => loadQuiz(topic);
        topicsDiv.appendChild(btn);
      });
    });
}

function loadQuiz(topic) {
  currentTopic = topic;

  // Fetch all three things in parallel: quiz questions, attempted, wrong clicks
  Promise.all([
    db.collection("quizi").doc(topic).get(),
    db.collection("attemptedQuestions").doc(topic).get(),
    db.collection("wrongAnswers").doc(topic).get(),
  ])
    .then(([quizDoc, attemptedDoc, wrongClicksDoc]) => {
      if (quizDoc.exists) {
        quiz = quizDoc.data().questions;
        shuffleNow = false;
      } else {
        quiz = []; // fallback if quiz not found
      }

      answered = attemptedDoc.exists ? attemptedDoc.data() : {};
      wrongClicks = wrongClicksDoc.exists ? wrongClicksDoc.data() : {};

      displayQuiz(); // ✅ Called only once after everything ready
    })
    .catch((error) => {
      console.error("Error loading quiz data:", error);
    });
}

function displayQuiz() {
  const quizBoxElement = document.getElementById("quizBox");
  quizBoxElement.innerHTML = "";

  const questionsToShow = [...quiz]; // Copy of quiz array

  if (shuffleNow) shuffleArray(questionsToShow);

  quizBoxElement.innerHTML = questionsToShow
    .map((question, index) => {
      const shuffledOptions = [...question.options];
      shuffleArray(shuffledOptions);

      const hasBeenAttempted = answered[question.id];
      let wrongClickCount = wrongClicks[question.id];

      if (wrongClickCount > 3) {
        const wrongAnswersRef = db.collection("wrongAnswers").doc(currentTopic);
        wrongAnswersRef.set({ [question.id]: 3 }, { merge: true });
        wrongClickCount = 3;
      }

      if (!hasBeenAttempted) {
        wrongClickCount = -1;
      }

      if (hasBeenAttempted && !wrongClickCount) {
        wrongClickCount = 0;
      }

      const borderColor = colorClass(wrongClickCount);

      return `
        <div class="qblock" id="question${index}" style="border-left:${borderColor} 3px solid; margin-bottom:10px;">
          <div class="question" id="question_text${index}">
            ${index + 1}. ${question.question}
          </div>
          <div class="options" id="options${index}">
            ${shuffledOptions
              .map(
                (option) => `
                  <div class="option" onclick="document.getElementById('radio${index}${option.key}').click();">
                    <input type="radio" id="radio${index}${option.key}" name="question${index}" value="${option.key}" onclick="checkAnswer(${index}, '${option.key}', this)" style="pointer-events: none;">
                    <label for="radio${index}${option.key}" style="margin:0;">${option.text}</label>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  // After rendering the quiz, calculate correct answers
  let correctAnswersCount = 0;

  quiz.forEach((question) => {
    if (answered[question.id] && !wrongClicks[question.id]) {
      correctAnswersCount++;
    }
  });

  updateResult(0);
  updateTopicResult(correctAnswersCount);
}

function checkAnswer(index, selected, element) {
  const correct = quiz[index].answer;
  const qid = quiz[index].id;
  if (answered[index]) return;

  if (selected === correct) {
    element.parentElement.classList.add("correct");
    updateResult(1);

    decrementWrongCount(qid, index);
  } else {
    element.parentElement.classList.add("wrong");
    const correctInput = document.querySelector(
      `input[name="question${index}"][value="${correct}"]`
    );
    if (correctInput) {
      correctInput.parentElement.classList.add("correct");
    }
    incrementWrongCount(qid, index);
  }

  document
    .querySelectorAll(`input[name="question${index}"]`)
    .forEach((inp) => (inp.disabled = true));

  answered[index] = selected === correct;

  answeredNow[quiz[index].id] = true;

  // Mark as attempted
  markAttempted(qid);

  // NEW: Visually disable the question block
  const questionBlock = document.getElementById("question" + index);
  if (questionBlock) {
    questionBlock.classList.add("disabled-question");
  }
}

function markAttempted(questionId) {
  if (!answered[questionId]) {
    const ref = db.collection("attemptedQuestions").doc(currentTopic);
    ref
      .set(
        {
          [questionId]: true,
        },
        { merge: true }
      )
      .then(() => {
        console.log(`Unattempted question answered: ${questionId}`);
      });
  } else {
    //console.log("already attempted");
  }
}
var score = 0;

function updateResult(val) {
  const total = quiz.length;
  score = score + val;
  console.log(score);
  document.getElementById(
    "result"
  ).textContent = `Your score : ${score}/${total}`;
}

var topicScore = 0;
function updateTopicResult(val) {
  const total = quiz.length;
  topicScore = topicScore + val;
  console.log(topicScore);
  document.getElementById(
    "result2"
  ).textContent = ` Topic  score : ${topicScore}/${total}`;
}

function incrementWrongCount(questionId, index) {
  const ref = db.collection("wrongAnswers").doc(currentTopic);
  const elem = document.getElementById("question" + index);

  const previousWrongCount = wrongClicks[questionId] || 0;

  if (previousWrongCount === 0) {
    updateTopicResult(-1);
  }

  const wrongCountInitial = previousWrongCount;
  wrongClicksNow[questionId] =
    wrongCountInitial >= 3 ? 3 : wrongCountInitial + 1;

  let updateValue;
  if (wrongCountInitial >= 3) {
    updateValue = 3;
  } else if (wrongCountInitial > 0) {
    updateValue = wrongCountInitial + 1;
  } else {
    updateValue = 1;
  }

  console.log(`Initial wrong: ${wrongCountInitial}, Now: ${updateValue}`);

  // Update Firestore
  ref.set({ [questionId]: updateValue }, { merge: true });

  elem.style.borderLeftColor = colorClass(updateValue);
}

function decrementWrongCount(questionId, index) {
  const ref = db.collection("wrongAnswers").doc(currentTopic);
  var elem = document.getElementById("question" + index);

  if (wrongClicks[questionId]) {
    if (wrongClicks[questionId] == 1) {
      updateTopicResult(1);
    }
  } else {
    updateTopicResult(0);
  }

  var wrongCountInitial = wrongClicks[questionId] || 0;
  let decrementValue;

  if (wrongCountInitial <= 1) {
    decrementValue = 0; // If 0 or 1, reset to 0
  } else if (wrongCountInitial >= 3) {
    decrementValue = 2; // If 3 or more, set to 2
  } else {
    decrementValue = wrongCountInitial - 1; // Else, normal decrement
  }

  // wrongClicksNow[questionId] = decrementValue;

  console.log(
    "  initial " + wrongCountInitial + " and   now  " + decrementValue
  );

  // Now update Firestore
  ref.set({ [questionId]: decrementValue }, { merge: true });

  switch (decrementValue) {
    case 3:
      elem.style.borderLeftColor = colorClass(3);
      break;
    case 2:
      elem.style.borderLeftColor = colorClass(2);
      break;
    case 1:
      elem.style.borderLeftColor = colorClass(1);
      break;
    case 0:
      elem.style.borderLeftColor = colorClass(0);
      break;
    case -1:
      elem.style.borderLeftColor = colorClass(0);
      break;
    default:
      elem.style.borderLeftColor = colorClass(3);
      break;
  }
}

function colorClass(n) {
  if (n === 3) return "#ff0000";
  else if (n === 2) return "#ff7e43";
  else if (n === 1) return "#4c4a94";
  else if (n === 0) return "#00ff00";
  else return "#808080";
}

function showUnattempted() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    const q = quiz[index];
    const isAttempted = answered[q.id] || answeredNow[q.id]; // <-- Notice: use q.id, not just index

    if (isAttempted) {
      block.style.display = "none"; // hide attempted
    } else {
      block.style.display = "block"; // show unattempted
    }
  });
}

function showUnattemptedNow() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    const q = quiz[index];
    const isAttempted = answeredNow[q.id]; // <-- Notice: use q.id, not just index

    if (isAttempted) {
      block.style.display = "none"; // hide attempted
    } else {
      block.style.display = "block"; // show unattempted
    }
  });
}

function showAttempted() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    const q = quiz[index];
    const isAttempted = answeredNow[q.id]; // <-- Notice: use q.id, not just index

    if (isAttempted) {
      block.style.display = "block"; // hide attempted
    } else {
      block.style.display = "none"; // show unattempted
    }
  });
}

function showWrong() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    const q = quiz[index];
    const wrongAnswer = wrongClicksNow[q.id]; // <-- Notice: use q.id, not just index

    if (wrongAnswer) {
      block.style.display = "block"; // hide attempted
    } else {
      block.style.display = "none"; // show unattempted
    }
  });
}

function showAllWrong() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    // Access the div with class 'colorDiv' inside each questionBlock
    const colorDiv = block.querySelector(".qblock");

    if (colorDiv) {
      // Now you can manipulate the colorDiv
      const backgroundColor = rgbToHex(
        window.getComputedStyle(colorDiv).backgroundColor
      );
      const targetColors = ["#ff0000", "#ff7e43", "#4c4a94"];

      if (targetColors.includes(backgroundColor.toLowerCase())) {
        block.style.display = "block";
      } else {
        block.style.display = "none";
      }
    }
  });
}

function showRight() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    const q = quiz[index];
    const wrongAnswer = wrongClicksNow[q.id]; // <-- Notice: use q.id, not just index
    const isAttempted = answeredNow[q.id];

    if (!wrongAnswer && isAttempted) {
      block.style.display = "block"; // hide attempted
    } else {
      block.style.display = "none"; // show unattempted
    }
  });
}
function showAllQuestions() {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    block.style.display = "block"; // hide attempted
  });
}

function showColorDiv(clr) {
  const quizBox = document.getElementById("quizBox");
  const questionBlocks = quizBox.querySelectorAll(".qblock");

  questionBlocks.forEach((block, index) => {
    // Access the div with class 'colorDiv' inside each questionBlock

    if (block) {
      // Now you can manipulate the colorDiv
      const leftColor = rgbToHex(
        window.getComputedStyle(block).borderLeftColor
      );
      if (leftColor === clr) {
        block.style.display = "block"; // hide attempted
      } else {
        block.style.display = "none"; // hide attempted
      }
    }
  });
}

function handleFilterChange(event) {
  const value = event.target.value;

  // Call respective functions based on the selected value
  switch (value) {
    case "option1":
      showAllQuestions();
      break;
    case "option2":
      showWrong();
      break;
    case "option3":
      showRight();
      break;
    case "option4":
      showAttempted();
      break;
    case "option5":
      showUnattempted();
      break;
    case "option6":
      showUnattemptedNow();
      break;

    case "option7":
      showColorDiv("#ff0000");
      break;
    case "option8":
      showColorDiv("#ff7e43");
      break;
    case "option9":
      showColorDiv("#4c4a94");
      break;
    case "option10":
      showColorDiv("#00ff00");
      break;
    case "option11":
      showColorDiv("#808080");
      break;
    default:
      showAllQuestions();
      break;
  }
}

function rgbToHex(rgb) {
  var result = rgb.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
  return result
    ? "#" +
        ("0" + parseInt(result[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(result[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(result[3], 10).toString(16)).slice(-2)
    : rgb;
}

function backGroundColorCheck(colorGiven, colorMatchedTo) {
  var hexColor = rgbToHex(colorGiven);

  // Check if the color is black in hex
  if (colorGiven === colorMatchedTo) {
    return true;
  } else {
    return false;
  }
}

function dynamicWrongCountUpdate(questionId) {}
window.onload = loadTopics;
