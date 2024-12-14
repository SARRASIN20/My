const fs = require('fs');
const path = require('path');

// Icône en base64 (un carré bleu simple)
const iconBase64 = `
iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABHNCSVQICAgIfAhkiAAAA
AlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGKSURBVGiB7ZexSgNBEIb/
EQtBCFgEkoiFlZ1gYyOCrYVgI1j4BvoCPkLewcbOB7ASFBsrGxsLGwtBEEUQRBQUQf8WO4Fwzl3udm/
vQph/Ydhvdmf+2Z29HZbIyclxQzX0/
0LSQFImafL6knRJLY6kiqSGpD+Fdb2kqqQ5SQtBrNckHUhakfTitP8r6UnSsaRTM7vLNM7MCr+AJaAFtIEWMJ/
w7hKwDZwDbeAH6AA3wBawCIwM9K8Ae8A18A18Ax/
AOXCQtX5WA0PAKfGcAeOh/
uPABfG0gfWkMfIYWA0G7wIvQXAP2AUGQ/
0ngTvn3wU2gKHg3hBw7Px3wEQWA0dB8E9gNWGMMeAyCN4DZmP8ZoOxPK/
AWJYV8AD6wHhK33ngyfnvA9MxftPAvfM/
TeqfZKAGfAEPQC2l7whw4/
w3Y3xrLu4NGEkbPMnAuQu8mMJ3COg4v7UYv1oQ1wGG0wRPMvDpAn+
l8B0Evpzf94DfQBDzGyjHxU4ykDnlYcQdxjg5Of8bf4W2sW8ZKhNEAAAAAElFTkSuQmCC
`;

const iconPath = path.join(__dirname, '..', 'icons', 'icon48.png');

// Créer le dossier icons s'il n'existe pas
if (!fs.existsSync(path.dirname(iconPath))) {
  fs.mkdirSync(path.dirname(iconPath));
}

// Écrire l'icône
fs.writeFileSync(iconPath, Buffer.from(iconBase64, 'base64')); 