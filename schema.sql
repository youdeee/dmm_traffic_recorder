CREATE TABLE contracts (
id MEDIUMINT NOT NULL AUTO_INCREMENT,
phone_number CHAR(30) NOT NULL,
name CHAR(30) NOT NULL,
createdAt datetime,
updatedAt datetime,
PRIMARY KEY (id)
);

CREATE TABLE traffic_logs (
id MEDIUMINT NOT NULL AUTO_INCREMENT,
contract_id MEDIUMINT NOT NULL,
date date NOT NULL,
traffic_fast FLOAT NOT NULL DEFAULT 0,
traffic_slow FLOAT NOT NULL DEFAULT 0,
createdAt datetime,
updatedAt datetime,
PRIMARY KEY (id),
foreign key(contract_id) references contracts(id)
);
